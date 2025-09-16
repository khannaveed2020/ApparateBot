import * as restify from 'restify';
import { BotFrameworkAdapter, CardFactory, MemoryStorage, UserState, TurnContext } from 'botbuilder';
import { cases } from './cases';
import { getCaseSelectionCard, getConfirmationCard } from './adaptiveCards';
import axios from 'axios';

const server = restify.createServer();

// Add middleware to parse JSON request bodies
server.use(restify.plugins.bodyParser());

server.listen(3979, () => {
    console.log(`User Server listening to http://localhost:3979`);
});


const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId || '',
    appPassword: process.env.MicrosoftAppPassword || ''
});

const memoryStorage = new MemoryStorage();
const userState = new UserState(memoryStorage);
const dialogStateAccessor = userState.createProperty('dialogState');

adapter.onTurnError = async (context, error) => {
    console.error(`\n [onTurnError]: ${error}`);
    await context.sendActivity('Oops. Something went wrong!');
};

server.post('/api/messages', async (req, res) => {
    await adapter.processActivity(req, res, async (context) => {
        const activity = context.activity;
        const state = await dialogStateAccessor.get(context, {});

        // Show welcome banner on conversationUpdate
        if (activity.type === 'conversationUpdate' && activity.membersAdded && activity.membersAdded.length > 0) {
            await context.sendActivity('Welcome to Aparate Handover Bot. Please type handover to initiate handover process.');
            return;
        }

        // Welcome banner unless 'handover' command
        if (activity.type === 'message' && !state.step) {
            if (activity.text && activity.text.trim().toLowerCase() === 'handover') {
                await context.sendActivity({
                    attachments: [CardFactory.adaptiveCard(getCaseSelectionCard(cases))]
                });
                state.step = 'caseSelection';
                await dialogStateAccessor.set(context, state);
                await userState.saveChanges(context);
            } else {
                await context.sendActivity('Welcome to Aparate Handover Bot. Please type handover to initiate handover process.');
            }
            return;
        }

        // Case selection
        if (activity.value && activity.value.caseNumber && state.step === 'caseSelection') {
            state.selectedCase = cases.find(c => c.caseNumber === activity.value.caseNumber);
            await context.sendActivity({
                attachments: [CardFactory.adaptiveCard(getConfirmationCard(state.selectedCase.caseNumber))]
            });
            state.step = 'confirmation';
            await dialogStateAccessor.set(context, state);
            await userState.saveChanges(context);
            return;
        }

        // Confirmation
        if (activity.value && activity.value.confirmation && state.step === 'confirmation') {
            const confirm = activity.value.confirmation.trim().toLowerCase();
            if (['yes', 'y'].includes(confirm)) {
                await context.sendActivity('Checking eligibility of handover');
                // Validate handover criteria
                const c = state.selectedCase;
                if (c.severity === 'A' && c.is247) {
                    try {
                        const conversationRef = TurnContext.getConversationReference(context.activity);
                        // Send case to TA Bot with conversation reference
                        await axios.post('http://localhost:3978/api/handover', {
                            case: c,
                            conversationRef: conversationRef
                        });
                        await context.sendActivity('Case sent for TA approval. Waiting for TA response...');
                        state.step = 'waitingTA';
                        await dialogStateAccessor.set(context, state);
                        await userState.saveChanges(context);
                    } catch (err) {
                        console.error('Error sending case to TA Bot:', err);
                        await context.sendActivity('Failed to send case to TA Bot. Please check TA Bot status.');
                        state.step = undefined;
                        await dialogStateAccessor.set(context, state);
                        await userState.saveChanges(context);
                    }
                } else {
                    await context.sendActivity('The case does not match handover criteria');
                    state.step = undefined;
                    await dialogStateAccessor.set(context, state);
                    await userState.saveChanges(context);
                }
            } else {
                await context.sendActivity('Handover cancelled.');
                state.step = undefined;
                await dialogStateAccessor.set(context, state);
                await userState.saveChanges(context);
            }
            return;
        }
    });
});

// New endpoint to receive TA responses
server.post('/api/ta-response', async (req, res) => {
    const { conversationRef, decision, comment } = req.body;
    
    try {
        // Use stored conversation reference to send message to user
        await adapter.continueConversation(conversationRef, async (context) => {
            if (decision === 'approve') {
                await context.sendActivity(`The handover is approved with the following comment: ${comment}`);
                await context.sendActivity('Updated the Sharepoint with the case handover details, please send the case to queue and connect with the next engineer once assigned.');
            } else {
                await context.sendActivity(`Handover rejected. TA comment: ${comment}`);
            }
        });
        res.send(200, { status: 'delivered' });
    } catch (error) {
        console.error('Error delivering TA response:', error);
        res.send(500, { error: 'Failed to deliver response' });
    }
});
