import * as restify from 'restify';
import { BotFrameworkAdapter, CardFactory, MemoryStorage, UserState, TurnContext } from 'botbuilder';
import { cases } from './cases';
import { getCaseSelectionCard, getConfirmationCard } from './adaptiveCards';
import axios from 'axios';
import { generateHandoverReport, saveHandoverReport, logHandoverOperation } from './handoverReport';

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

// LOGGING SYSTEM: Comprehensive operation tracking
let operationCounter = 0;
const operationHistory: any[] = [];

const logUserOperation = (operation: string, data: any, startTime?: number) => {
    operationCounter++;
    const timestamp = new Date().toISOString();
    const timing = startTime ? `(${Date.now() - startTime}ms)` : '';
    const memUsage = process.memoryUsage();
    
    console.log(`[USER-${operationCounter}] [${timestamp}] ${operation}${timing}:`, JSON.stringify(data, null, 2));
    
    // Log memory usage every 10 operations
    if (operationCounter % 10 === 0) {
        console.log(`[MEMORY] RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }
    
    operationHistory.push({ 
        op: operation, 
        data, 
        timestamp, 
        counter: operationCounter,
        timing: timing || null,
        memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024)
        }
    });
    
    // Keep only last 50 operations to prevent memory issues
    if (operationHistory.length > 50) {
        operationHistory.splice(0, operationHistory.length - 50);
    }
};

adapter.onTurnError = async (context, error) => {
    logUserOperation('error_occurred', {
        error: error.message,
        conversationId: context.activity?.conversation?.id,
        activityType: context.activity?.type,
        stack: error.stack?.split('\n').slice(0, 3) // First 3 lines of stack trace
    });
    console.error(`\n [onTurnError]: ${error}`);
    await context.sendActivity('Oops. Something went wrong!');
};

server.post('/api/messages', async (req, res) => {
    const startTime = Date.now();
    await adapter.processActivity(req, res, async (context) => {
        const activity = context.activity;
        const state = await dialogStateAccessor.get(context, {});

        logUserOperation('message_received', {
            messageType: activity.type,
            conversationId: activity.conversation?.id,
            hasText: !!activity.text,
            hasValue: !!activity.value,
            currentStep: state.step || 'none'
        });

        // Show welcome banner on conversationUpdate
        if (activity.type === 'conversationUpdate' && activity.membersAdded && activity.membersAdded.length > 0) {
            logUserOperation('conversation_started', {
                membersAdded: activity.membersAdded?.length || 0,
                conversationId: activity.conversation?.id
            });
            await context.sendActivity('Welcome to Aparate Handover Bot. Please type handover to initiate handover process.');
            return;
        }

        // Welcome banner unless 'handover' command
        if (activity.type === 'message' && !state.step) {
            if (activity.text && activity.text.trim().toLowerCase() === 'handover') {
                logUserOperation('handover_initiated', {
                    conversationId: activity.conversation?.id,
                    userId: activity.from?.id,
                    availableCases: cases.length
                });
                await context.sendActivity({
                    attachments: [CardFactory.adaptiveCard(getCaseSelectionCard(cases))]
                });
                state.step = 'caseSelection';
                await dialogStateAccessor.set(context, state);
                await userState.saveChanges(context);
            } else {
                logUserOperation('message_without_handover', {
                    messageText: activity.text,
                    conversationId: activity.conversation?.id
                });
                await context.sendActivity('Welcome to Aparate Handover Bot. Please type handover to initiate handover process.');
            }
            return;
        }

        // Case selection
        if (activity.value && activity.value.caseNumber && state.step === 'caseSelection') {
            state.selectedCase = cases.find(c => c.caseNumber === activity.value.caseNumber);
            logUserOperation('case_selected', {
                caseNumber: activity.value.caseNumber,
                conversationId: activity.conversation?.id,
                userId: activity.from?.id,
                caseFound: !!state.selectedCase
            });
            await context.sendActivity({
                attachments: [CardFactory.adaptiveCard(getConfirmationCard(state.selectedCase))]
            });
            state.step = 'confirmation';
            await dialogStateAccessor.set(context, state);
            await userState.saveChanges(context);
            return;
        }

        // Confirmation
        if (activity.value && activity.value.confirmation && state.step === 'confirmation') {
            const confirm = activity.value.confirmation.trim().toLowerCase();
            logUserOperation('confirmation_received', {
                confirmation: confirm,
                caseNumber: state.selectedCase?.caseNumber,
                conversationId: activity.conversation?.id,
                userId: activity.from?.id
            });
            if (['yes', 'y'].includes(confirm)) {
                await context.sendActivity('Checking eligibility of handover');
                // Validate handover criteria
                const c = state.selectedCase;
                if (c.severity === 'A' || c.is247) {
                    logUserOperation('handover_eligible', {
                        caseNumber: c.caseNumber,
                        severity: c.severity,
                        is247: c.is247,
                        conversationId: activity.conversation?.id
                    });
                    try {
                        const conversationRef = TurnContext.getConversationReference(context.activity);
                        // Send case to TA Bot with conversation reference
                        await axios.post('http://localhost:3978/api/handover', {
                            case: c,
                            conversationRef: conversationRef
                        });
                        logUserOperation('case_sent_to_ta', {
                            caseNumber: c.caseNumber,
                            conversationId: activity.conversation?.id,
                            taEndpoint: 'http://localhost:3978/api/handover'
                        });
                        await context.sendActivity('Case sent for TA approval. Waiting for TA response...');
                        state.step = 'waitingTA';
                        await dialogStateAccessor.set(context, state);
                        await userState.saveChanges(context);
                    } catch (err) {
                        logUserOperation('ta_communication_error', {
                            caseNumber: c.caseNumber,
                            error: err instanceof Error ? err.message : String(err),
                            conversationId: activity.conversation?.id
                        });
                        console.error('Error sending case to TA Bot:', err);
                        await context.sendActivity('Failed to send case to TA Bot. Please check TA Bot status.');
                        state.step = undefined;
                        await dialogStateAccessor.set(context, state);
                        await userState.saveChanges(context);
                    }
                } else {
                    // Detailed handover criteria validation - case fails if BOTH conditions are false
                    const failureReasons = [];
                    
                    if (c.severity !== 'A') {
                        failureReasons.push(`Case severity is '${c.severity}' (needs 'A')`);
                    }
                    
                    if (!c.is247) {
                        failureReasons.push('Case is not marked as 24/7 support');
                    }
                    
                    const reasonText = failureReasons.join(' and ');
                    
                    logUserOperation('handover_ineligible', {
                        caseNumber: c.caseNumber,
                        severity: c.severity,
                        is247: c.is247,
                        conversationId: activity.conversation?.id,
                        reason: reasonText,
                        failureReasons: failureReasons
                    });

                    // Generate handover report for failed validation
                    try {
                        const report = generateHandoverReport(
                            c, 
                            false, // valid = false
                            reasonText, // reject reason
                            'Failed handover criteria validation at UserBot'
                        );
                        const reportPath = saveHandoverReport(report);
                        logHandoverOperation('report_generated_validation_failure', {
                            caseNumber: c.caseNumber,
                            reportPath: reportPath,
                            reason: reasonText
                        });
                    } catch (err) {
                        console.error('Error generating handover report:', err);
                        logUserOperation('report_generation_error', {
                            caseNumber: c.caseNumber,
                            error: err instanceof Error ? err.message : String(err)
                        });
                    }
                    
                    await context.sendActivity(`The case does not match handover criteria: ${reasonText}. Cases need either Severity A OR 24/7 support to be eligible for handover.`);
                    
                    state.step = undefined;
                    await dialogStateAccessor.set(context, state);
                    await userState.saveChanges(context);
                }
            } else {
                logUserOperation('handover_cancelled', {
                    caseNumber: state.selectedCase?.caseNumber,
                    confirmation: confirm,
                    conversationId: activity.conversation?.id,
                    userId: activity.from?.id
                });
                await context.sendActivity('Handover cancelled.');
                state.step = undefined;
                await dialogStateAccessor.set(context, state);
                await userState.saveChanges(context);
            }
            return;
        }

        const endTime = Date.now();
        logUserOperation('message_processed', {
            processingTime: endTime - startTime,
            conversationId: activity.conversation?.id,
            finalStep: state.step || 'none'
        });
    });
});

// New endpoint to receive TA responses
server.post('/api/ta-response', async (req, res) => {
    const { conversationRef, decision, comment } = req.body;
    
    logUserOperation('ta_response_received', {
        decision,
        hasComment: !!comment,
        conversationId: conversationRef?.conversation?.id
    });

    try {
        // Use stored conversation reference to send message to user
        await adapter.continueConversation(conversationRef, async (context) => {
            if (decision === 'approve') {
                logUserOperation('handover_approved', {
                    conversationId: conversationRef?.conversation?.id,
                    comment: comment || 'No comment provided'
                });
                await context.sendActivity(`The handover is approved with the following comment: ${comment}`);
                await context.sendActivity('Updated the Sharepoint with the case handover details, please send the case to queue and connect with the next engineer once assigned.');
            } else {
                logUserOperation('handover_rejected', {
                    conversationId: conversationRef?.conversation?.id,
                    comment: comment || 'No comment provided'
                });
                await context.sendActivity(`Handover rejected. TA comment: ${comment}`);
            }
        });
        res.send(200, { status: 'delivered' });
    } catch (error) {
        logUserOperation('ta_response_delivery_error', {
            error: error instanceof Error ? error.message : String(error),
            decision,
            conversationId: conversationRef?.conversation?.id
        });
        console.error('Error delivering TA response:', error);
        res.send(500, { error: 'Failed to deliver response' });
    }
});
