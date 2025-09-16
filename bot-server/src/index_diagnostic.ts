import * as restify from 'restify';
import { BotFrameworkAdapter, TurnContext, MemoryStorage, ConversationState, ActivityTypes } from 'botbuilder';
import { Request, Response } from 'restify';
import axios from 'axios';

// DIAGNOSTIC: Comprehensive Bot Framework behavior analysis
console.log('🔍 STARTING COMPREHENSIVE DIAGNOSTIC MODE');
console.log('📊 This version will track all Bot Framework operations systematically');

// Create server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// Bot adapter and storage
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId || '',
    appPassword: process.env.MicrosoftAppPassword || ''
});

const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const taDialogStateAccessor = conversationState.createProperty('TADialogState');

// DIAGNOSTIC: Multiple storage strategies for comprehensive analysis
const globalStorage: {
    handover: any;
    taContext: any;
    taConversationId: string | null;
    stateHistory: any[];
} = {
    handover: null,
    taContext: null,
    taConversationId: null,
    stateHistory: []
};

const activeTAConversations = new Map();
const pendingHandovers = new Map();
const conversationRefs = new Map();

// DIAGNOSTIC: Operation tracking
let operationCounter = 0;

const logOperation = (operation: string, data: any) => {
    operationCounter++;
    const timestamp = new Date().toISOString();
    console.log(`[${operationCounter}] [${timestamp}] ${operation}:`, JSON.stringify(data, null, 2));
    globalStorage.stateHistory.push({ op: operation, data, timestamp, counter: operationCounter });
    
    // Keep only last 50 operations to prevent memory issues
    if (globalStorage.stateHistory.length > 50) {
        globalStorage.stateHistory = globalStorage.stateHistory.slice(-50);
    }
};

// DIAGNOSTIC: Main bot message handler with comprehensive tracking
class TABot {
    async onMessage(context: TurnContext, next: () => Promise<void>) {
        logOperation('onMessage_start', {
            messageType: context.activity?.type,
            messageText: context.activity?.text,
            conversationId: context.activity?.conversation?.id,
            channelId: context.activity?.channelId,
            hasValue: !!context.activity?.value,
            fullActivity: context.activity
        });

        // Store conversation reference with multiple strategies
        const conversationRef = TurnContext.getConversationReference(context.activity);
        activeTAConversations.set(context.activity.conversation.id, conversationRef);
        conversationRefs.set(context.activity.conversation.id, conversationRef);
        globalStorage.taConversationId = context.activity.conversation.id;

        logOperation('conversation_reference_stored', {
            conversationId: context.activity.conversation.id,
            refKeys: Object.keys(conversationRef),
            activeTACount: activeTAConversations.size,
            globalStorageId: globalStorage.taConversationId
        });

        // Multiple state access diagnostic
        let currentDialogState;
        try {
            currentDialogState = await taDialogStateAccessor.get(context, () => ({ source: 'new', created: Date.now() }));
            logOperation('current_state_retrieved', currentDialogState);
        } catch (stateError: any) {
            logOperation('current_state_retrieval_failed', { error: stateError?.message });
            currentDialogState = { source: 'fallback', created: Date.now() };
        }

        // Check for adaptive card submission
        if (context.activity.type === 'message' && context.activity.value) {
            logOperation('adaptive_card_submission_detected', {
                value: context.activity.value,
                currentState: currentDialogState
            });

            await this.handleAdaptiveCardSubmission(context, context.activity.value);
            return await next();
        }

        // Regular message processing with diagnostic
        if (context.activity.type === 'message') {
            const messageText = context.activity.text?.toLowerCase() || '';

            logOperation('regular_message_processing', {
                messageText,
                currentState: currentDialogState,
                globalHandover: globalStorage.handover,
                pendingHandoversCount: pendingHandovers.size
            });

            // Check for pending handovers immediately when TA connects
            if (pendingHandovers.size > 0) {
                logOperation('pending_handovers_found_processing', {
                    pendingCount: pendingHandovers.size,
                    pendingEntries: Array.from(pendingHandovers.entries())
                });

                await this.checkAndPresentPendingHandovers(context);
            }

            // Standard TA commands with diagnostic
            if (messageText.includes('status') || messageText.includes('diagnostic')) {
                const diagnosticReport = {
                    timestamp: new Date().toISOString(),
                    operationCount: operationCounter,
                    globalStorage: globalStorage,
                    activeTAConversations: activeTAConversations.size,
                    pendingHandovers: pendingHandovers.size,
                    conversationRefs: conversationRefs.size,
                    stateHistory: globalStorage.stateHistory.slice(-10), // Last 10 operations
                    currentState: currentDialogState
                };

                await context.sendActivity(`🔍 **DIAGNOSTIC REPORT**\n\`\`\`json\n${JSON.stringify(diagnosticReport, null, 2)}\n\`\`\``);
                logOperation('diagnostic_report_sent', diagnosticReport);
                return await next();
            }

            if (messageText.includes('clear')) {
                // Clear all storage for fresh start
                globalStorage.handover = null;
                globalStorage.taContext = null;
                globalStorage.stateHistory = [];
                activeTAConversations.clear();
                pendingHandovers.clear();
                conversationRefs.clear();

                currentDialogState = { source: 'cleared', created: Date.now() };
                await taDialogStateAccessor.set(context, currentDialogState);
                await conversationState.saveChanges(context);

                await context.sendActivity('🧹 All storage cleared for fresh diagnostic.');
                logOperation('storage_cleared', 'all_cleared');
                return await next();
            }

            // Default TA response
            await context.sendActivity('👋 TA Bot diagnostic mode active. Send "status" for diagnostic report, "clear" to reset storage.');
            logOperation('default_ta_response_sent', { messageText });
        }

        logOperation('onMessage_complete', {
            finalState: currentDialogState,
            operationCount: operationCounter
        });

        return await next();
    }

    // DIAGNOSTIC: Comprehensive adaptive card submission handler
    async handleAdaptiveCardSubmission(context: TurnContext, submissionData: any) {
        logOperation('handleAdaptiveCardSubmission_start', {
            submissionData,
            conversationId: context.activity?.conversation?.id
        });

        // Multiple state retrieval strategies for diagnostic
        let dialogState;
        try {
            dialogState = await taDialogStateAccessor.get(context, () => ({ source: 'submission_new', created: Date.now() }));
            logOperation('submission_state_retrieved_method1', dialogState);
        } catch (e: any) {
            logOperation('submission_state_retrieval_failed', { error: e?.message });
            dialogState = { source: 'submission_fallback', submissionData, created: Date.now() };
        }

        // Compare with global storage
        logOperation('submission_state_comparison', {
            dialogState,
            globalHandover: globalStorage.handover,
            globalTAContext: globalStorage.taContext
        });

        const action = submissionData?.action;
        logOperation('submission_action_identified', { action, fullSubmission: submissionData });

        if (action === 'acknowledge') {
            logOperation('acknowledge_action_processing', dialogState);

            // Update state for approval step
            dialogState.step = 'waitingApproval';
            dialogState.acknowledgedAt = new Date().toISOString();

            // Send approval card
            const approvalCard = this.getTAApprovalCard();

            try {
                await context.sendActivity({
                    attachments: [{
                        contentType: 'application/vnd.microsoft.card.adaptive',
                        content: approvalCard
                    }]
                });
                logOperation('approval_card_sent', 'success');
            } catch (cardError: any) {
                logOperation('approval_card_failed', { error: cardError?.message });
            }

            await context.sendActivity('✅ Handover acknowledged. Please review and approve/reject.');

        } else if (action === 'approve' || action === 'reject') {
            logOperation('approval_action_processing', { action, submissionData });

            const comments = submissionData?.comments || 'No comments provided';
            dialogState.step = 'completed';
            dialogState.decision = action;
            dialogState.comments = comments;
            dialogState.completedAt = new Date().toISOString();

            // Send completion message
            const emoji = action === 'approve' ? '✅' : '❌';
            await context.sendActivity(`${emoji} Handover ${action}d. Comments: ${comments}`);

            // Send response back to UserBot via HTTP
            if (dialogState.originalConversationId || globalStorage.handover?.conversationId) {
                const targetConversationId = dialogState.originalConversationId || globalStorage.handover?.conversationId;

                try {
                    logOperation('sending_response_to_userbot', {
                        targetConversationId,
                        decision: action,
                        comments
                    });

                    await axios.post('http://localhost:3979/api/ta-response', {
                        conversationId: targetConversationId,
                        decision: action,
                        comments: comments,
                        diagnostic: true,
                        timestamp: new Date().toISOString()
                    });

                    logOperation('response_sent_to_userbot', 'success');
                } catch (httpError: any) {
                    logOperation('response_to_userbot_failed', { error: httpError?.message });
                }
            } else {
                logOperation('no_target_conversation_id', {
                    dialogState: dialogState,
                    globalHandover: globalStorage.handover
                });
            }
        } else {
            logOperation('unknown_submission_action', { action, submissionData });
            await context.sendActivity(`❓ Unknown action: ${action}`);
        }

        // Multiple state save attempts
        try {
            await taDialogStateAccessor.set(context, dialogState);
            logOperation('submission_state_saved_method1', 'success');
        } catch (e: any) {
            logOperation('submission_state_save_failed', { error: e?.message });
        }

        try {
            await conversationState.saveChanges(context);
            logOperation('submission_conversation_state_saved', 'success');
        } catch (e: any) {
            logOperation('submission_conversation_save_failed', { error: e?.message });
        }

        // Update global storage
        globalStorage.taContext = {
            conversationId: context.activity?.conversation?.id,
            state: dialogState,
            lastSubmission: submissionData,
            timestamp: Date.now()
        };

        logOperation('handleAdaptiveCardSubmission_complete', {
            finalState: dialogState,
            globalStorage: globalStorage
        });
    }

    // DIAGNOSTIC: Check and present pending handovers
    async checkAndPresentPendingHandovers(context: TurnContext) {
        logOperation('checkAndPresentPendingHandovers_start', {
            pendingCount: pendingHandovers.size,
            conversationId: context.activity?.conversation?.id
        });

        if (pendingHandovers.size > 0) {
            const [conversationId, pendingData] = Array.from(pendingHandovers.entries())[0];
            logOperation('presenting_pending_handover', { conversationId, pendingData });

            try {
                const dialogState = await taDialogStateAccessor.get(context, () => ({ source: 'pending_handover' }));

                // Set dialog state for acknowledgment step
                dialogState.step = 'waitingAcknowledgment';
                dialogState.handoverData = pendingData.data;
                dialogState.originalConversationId = conversationId;

                // Send acknowledgment card to TA
                const handoverCard = this.getTAHandoverCard(pendingData.data.case);

                await context.sendActivity({
                    attachments: [{
                        contentType: 'application/vnd.microsoft.card.adaptive',
                        content: handoverCard
                    }]
                });

                await context.sendActivity('⚠️ **PENDING HANDOVER REQUEST** - Please review the case details above and click "Acknowledge" to proceed.');

                // Save state
                await taDialogStateAccessor.set(context, dialogState);
                await conversationState.saveChanges(context);

                // Remove from pending
                pendingHandovers.delete(conversationId);

                logOperation('pending_handover_presented_successfully', {
                    conversationId,
                    dialogState: dialogState
                });

            } catch (error: any) {
                logOperation('pending_handover_presentation_failed', { 
                    error: error?.message,
                    conversationId 
                });
            }
        } else {
            await context.sendActivity('No pending handover requests. I\'ll notify you when a new handover request arrives.');
        }
    }

    // Adaptive card templates
    getTAHandoverCard(caseData: any) {
        return {
            type: 'AdaptiveCard',
            version: '1.3',
            body: [
                {
                    type: 'TextBlock',
                    text: '🚨 URGENT HANDOVER REQUEST (DIAGNOSTIC)',
                    weight: 'Bolder',
                    size: 'Medium',
                    color: 'Attention'
                },
                {
                    type: 'FactSet',
                    facts: [
                        { title: 'Case ID:', value: caseData.id },
                        { title: 'Severity:', value: caseData.severity },
                        { title: 'Customer:', value: caseData.customer },
                        { title: 'Issue:', value: caseData.issue }
                    ]
                }
            ],
            actions: [
                {
                    type: 'Action.Submit',
                    title: '✅ Acknowledge',
                    data: { action: 'acknowledge' }
                }
            ]
        };
    }

    getTAApprovalCard() {
        return {
            type: 'AdaptiveCard',
            version: '1.3',
            body: [
                {
                    type: 'TextBlock',
                    text: '📋 HANDOVER DECISION (DIAGNOSTIC)',
                    weight: 'Bolder',
                    size: 'Medium'
                },
                {
                    type: 'TextBlock',
                    text: 'Please approve or reject this handover request:'
                },
                {
                    type: 'Input.Text',
                    id: 'comments',
                    placeholder: 'Add your comments here...',
                    isMultiline: true
                }
            ],
            actions: [
                {
                    type: 'Action.Submit',
                    title: '✅ Approve',
                    data: { action: 'approve' },
                    style: 'positive'
                },
                {
                    type: 'Action.Submit',
                    title: '❌ Reject',
                    data: { action: 'reject' },
                    style: 'destructive'
                }
            ]
        };
    }
}

// DIAGNOSTIC: Comprehensive handover presentation function
const presentHandoverToTA = async (conversationId: string, handoverData: any) => {
    logOperation('presentHandoverToTA_start', { conversationId, handoverData });

    // Store in multiple strategies for comparison
    globalStorage.handover = { conversationId, handoverData, timestamp: Date.now() };

    logOperation('storage_updated', {
        globalHandover: globalStorage.handover,
        activeTACount: activeTAConversations.size,
        pendingCount: pendingHandovers.size
    });

    // Immediate analysis of active TA connections
    logOperation('ta_connection_analysis', {
        activeTAConversations: Array.from(activeTAConversations.entries()).map(([id, ref]) => ({
            id,
            refType: typeof ref,
            refKeys: Object.keys(ref || {})
        })),
        conversationRefs: Array.from(conversationRefs.entries())
    });

    // Real-time check (no delay for diagnostic)
    if (activeTAConversations.size > 0) {
        const [taConvId, taConversationRef] = Array.from(activeTAConversations.entries())[0];
        logOperation('attempting_immediate_delivery', { taConvId, refValid: !!taConversationRef });

        try {
            await adapter.continueConversation(taConversationRef, async (taContext) => {
                logOperation('continue_conversation_callback_start', {
                    contextValid: !!taContext,
                    contextKeys: Object.keys(taContext || {}),
                    activityValid: !!taContext?.activity
                });

                const dialogState = await taDialogStateAccessor.get(taContext, () => ({ source: 'continue_conversation' }));

                // Set state with diagnostic tracking
                dialogState.step = 'waitingAcknowledgment';
                dialogState.handoverData = handoverData;
                dialogState.originalConversationId = conversationId;
                dialogState.diagnosticTimestamp = Date.now();
                dialogState.diagnosticId = operationCounter;

                logOperation('state_prepared', dialogState);

                // Create adaptive card
                const bot = new TABot();
                const handoverCard = bot.getTAHandoverCard(handoverData.case);
                logOperation('adaptive_card_created', { cardValid: !!handoverCard });

                // Send card with diagnostic tracking
                try {
                    const cardActivity = {
                        attachments: [{
                            contentType: 'application/vnd.microsoft.card.adaptive',
                            content: handoverCard
                        }]
                    };

                    logOperation('sending_adaptive_card', cardActivity);
                    const cardResult = await taContext.sendActivity(cardActivity);
                    logOperation('adaptive_card_sent', { result: cardResult });
                } catch (cardError: any) {
                    logOperation('adaptive_card_send_failed', { error: cardError?.message });
                }

                // Send text message
                try {
                    const textResult = await taContext.sendActivity('⚠️ **DIAGNOSTIC HANDOVER** - RCA in progress. Please interact.');
                    logOperation('text_message_sent', { result: textResult });
                } catch (textError: any) {
                    logOperation('text_message_failed', { error: textError?.message });
                }

                // Save state
                try {
                    await taDialogStateAccessor.set(taContext, dialogState);
                    logOperation('state_saved_successfully', dialogState);
                } catch (saveError: any) {
                    logOperation('state_save_failed', { error: saveError?.message });
                }

                try {
                    await conversationState.saveChanges(taContext);
                    logOperation('conversation_state_saved', 'success');
                } catch (saveError: any) {
                    logOperation('conversation_state_save_failed', { error: saveError?.message });
                }

                globalStorage.taContext = {
                    conversationId: taContext.activity?.conversation?.id,
                    state: dialogState,
                    timestamp: Date.now()
                };

                logOperation('continue_conversation_callback_complete', globalStorage);
            });

            logOperation('handover_delivery_attempted', { success: true });
        } catch (error: any) {
            logOperation('handover_delivery_failed', {
                error: error?.message || String(error),
                stack: error?.stack,
                errorType: error?.constructor?.name
            });

            // Store for later
            pendingHandovers.set(conversationId, {
                data: handoverData,
                timestamp: new Date(),
                diagnostic: true,
                failureReason: error?.message || String(error)
            });
        }
    } else {
        logOperation('no_active_ta_storing_for_later', {
            conversationId,
            currentTime: new Date().toISOString()
        });

        pendingHandovers.set(conversationId, {
            data: handoverData,
            timestamp: new Date(),
            diagnostic: true,
            reason: 'no_active_ta'
        });
    }

    logOperation('presentHandoverToTA_complete', {
        finalState: {
            globalStorage: globalStorage,
            activeTACount: activeTAConversations.size,
            pendingCount: pendingHandovers.size
        }
    });
};

// Create bot instance
const taBot = new TABot();

// HTTP endpoint for receiving handover requests from UserBot
server.post('/api/handover', async (req: Request, res: Response) => {
    logOperation('http_handover_received', req.body);

    try {
        const { conversationId, caseData } = req.body;
        await presentHandoverToTA(conversationId, { case: caseData });
        res.send({ success: true, message: 'Handover request processed (diagnostic mode)' });
        logOperation('http_handover_response_sent', { success: true });
    } catch (error: any) {
        logOperation('http_handover_error', { error: error?.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to process handover request' }));
    }
});

// Bot endpoint
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        await taBot.onMessage(context, async () => {});
    });
});

// Start the server
const port = process.env.port || process.env.PORT || 3978;
server.listen(port, () => {
    console.log(`\n🤖 TA Bot Server (COMPREHENSIVE DIAGNOSTIC MODE) listening on port ${port}`);
    console.log(`📊 Full Bot Framework behavior analysis active`);
    console.log(`🔍 Send "status" to TA bot for diagnostic report`);
    console.log(`🧹 Send "clear" to TA bot to reset all storage`);
    console.log(`⚡ Real-time operation logging enabled`);
    logOperation('server_started', { port, mode: 'DIAGNOSTIC' });
});