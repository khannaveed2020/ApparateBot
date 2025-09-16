import * as restify from 'restify';
import { BotFrameworkAdapter, TurnContext, CardFactory, MemoryStorage, ConversationState } from 'botbuilder';
import { Request, Response } from 'restify';
import { getTAHandoverCard, getTAApprovalCard } from './adaptiveCards';
import axios from 'axios';

const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.listen(3979, () => {
    console.log(`Bot Server listening to http://localhost:3979`);
});

const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId || '',
    appPassword: process.env.MicrosoftAppPassword || ''
});

// DIAGNOSTIC: Track all Bot Framework operations
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const taDialogStateAccessor = conversationState.createProperty('taDialogState');

// DIAGNOSTIC: Multiple storage strategies for comparison
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

const mapStorage = new Map(); // Previous approach
const conversationRefs = new Map(); // Previous approach

// DIAGNOSTIC: Missing variable declarations from mixed code
const activeTAConversations = new Map();
const pendingHandovers = new Map();

// DIAGNOSTIC: State tracking
let operationCounter = 0;

const logOperation = (operation: string, data: any) => {
    operationCounter++;
    const timestamp = new Date().toISOString();
    console.log(`[${operationCounter}] [${timestamp}] ${operation}:`, data);
    globalStorage.stateHistory.push({ op: operation, data, timestamp, counter: operationCounter });
};

adapter.onTurnError = async (context: TurnContext, error: Error) => {
    console.error(`\n [onTurnError]: ${error}`);
    await context.sendActivity('Oops. Something went wrong!');
};


// Main bot endpoint (for Emulator and TA interactions)
server.post('/api/messages', async (req: Request, res: Response) => {
    await adapter.processActivity(req, res, async (context: TurnContext) => {
        await handleTAInteraction(context);
        await conversationState.saveChanges(context);
    });
});

// TA handover endpoint (called by UserBot)
server.post('/api/ta-handover', async (req: Request, res: Response) => {
    console.log('[TABot] Received handover request:', req.body);
    const { case: caseInfo, conversationRef } = req.body;
    
    try {
        // Respond immediately to UserBot to avoid blocking
        res.send(200, { status: 'received' });
        console.log('[TABot] Processing case:', caseInfo?.caseNumber);
        
        // Present handover to TA
        await presentHandoverToTA(conversationRef.conversation.id, {
            case: caseInfo,
            conversationRef: conversationRef
        });
        
        console.log('[TABot] Handover request prepared for TA review');
        
    } catch (error) {
        console.error('[TABot] Error processing TA handover:', error);
        res.send(500, { error: 'Processing failed' });
    }
});

// Interactive TA dialog handler
const handleTAInteraction = async (context: TurnContext) => {
    const dialogState = await taDialogStateAccessor.get(context, () => ({}));
    const text = context.activity.text?.toLowerCase() || '';
    
    console.log(`[TABot] Activity type: ${context.activity.type}, Conversation: ${context.activity.conversation.id}`);
    
    // Handle conversationUpdate (TA connects)
    if (context.activity.type === 'conversationUpdate' && context.activity.membersAdded && context.activity.membersAdded.length > 0) {
        const isBot = context.activity.membersAdded.some(member => member.id === context.activity.recipient?.id);
        if (!isBot) {
            // Store TA conversation reference for real-time notifications
            const taConversationRef = TurnContext.getConversationReference(context.activity);
            activeTAConversations.set(context.activity.conversation.id, taConversationRef);
            
            console.log(`[TABot] TA connected. Conversation ID: ${context.activity.conversation.id}`);
            console.log(`[TABot] Active TA conversations after connection: ${activeTAConversations.size}`);
            
            await context.sendActivity('Hello! I\'m the TA Bot. I handle handover requests from the User Bot.');
            
            // Check for pending handovers immediately when TA connects
            await checkAndPresentPendingHandovers(context, dialogState);
            
            // CRITICAL: Save state after handling conversationUpdate
            await taDialogStateAccessor.set(context, dialogState);
        }
        return;
    }
    
    // Store TA conversation reference for regular messages
    if (context.activity.type === 'message') {
        const taConversationRef = TurnContext.getConversationReference(context.activity);
        activeTAConversations.set(context.activity.conversation.id, taConversationRef);
    }
    
    // Debug: Log current dialog state and any card submission values
    console.log(`[TABot] Current dialog state:`, {
        step: dialogState.step,
        hasHandoverData: !!dialogState.handoverData,
        originalConversationId: dialogState.originalConversationId,
        messageText: text,
        activityValue: context.activity.value
    });
    
    // Handle adaptive card submissions
    if (context.activity.value) {
        console.log(`[TABot] Processing adaptive card submission with current state: step=${dialogState.step}`);
        await handleAdaptiveCardSubmission(context, dialogState);
        // Save state after handling adaptive card
        await taDialogStateAccessor.set(context, dialogState);
    } else if (context.activity.type === 'message' && text) {
        // Handle text messages (fallback for non-adaptive card interactions)
        await checkAndPresentPendingHandovers(context, dialogState);
        // Save state after handling message
        await taDialogStateAccessor.set(context, dialogState);
    }
};

const handleAdaptiveCardSubmission = async (context: TurnContext, dialogState: any) => {
    const submissionData = context.activity.value;
    console.log(`[TABot] Adaptive card submission received:`, submissionData);
    
    // Step 1: Handle acknowledgment
    if (submissionData.action === 'acknowledge' && dialogState.step === 'waitingAcknowledgment') {
        console.log(`[TABot] TA acknowledged handover request`);
        
        await context.sendActivity('✅ Case acknowledged. Please review and make your decision:');
        
        // Send approval/rejection card
        const approvalCard = getTAApprovalCard(dialogState.handoverData.case);
        await context.sendActivity({
            attachments: [{
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: approvalCard
            }]
        });
        
        // Update dialog state to wait for approval decision
        dialogState.step = 'waitingApproval';
        await taDialogStateAccessor.set(context, dialogState);
        
        console.log(`[TABot] Approval card sent to TA. Waiting for decision.`);
        return;
    }
    
    // Step 2: Handle approval/rejection decision
    if ((submissionData.decision === 'approve' || submissionData.decision === 'reject') && dialogState.step === 'waitingApproval') {
        const decision = submissionData.decision;
        const comment = submissionData.comment || 'No comment provided';
        
        console.log(`[TABot] TA made decision: ${decision}, Comment: ${comment}`);
        
        // Send response back to UserBot
        try {
            await axios.post(`http://localhost:3978/api/ta-response`, {
                conversationRef: dialogState.handoverData.conversationRef,
                decision: decision,
                comment: comment
            });
            
            await context.sendActivity(`✅ Handover request **${decision.toUpperCase()}D** successfully!`);
            await context.sendActivity(`📝 Your comment: "${comment}"`);
            await context.sendActivity(`📤 Response sent to user. Case handover process completed.`);
            
            console.log(`[TABot] Decision sent to UserBot: ${decision} with comment: ${comment}`);
        } catch (error) {
            console.error(`[TABot] Error sending response to UserBot:`, error);
            await context.sendActivity('❌ Error sending response to UserBot. Please try again.');
            return;
        }
        
        // Clear dialog state
        dialogState.step = undefined;
        dialogState.handoverData = null;
        dialogState.originalConversationId = null;
        await taDialogStateAccessor.set(context, dialogState);
        
        console.log(`[TABot] Dialog state cleared. Ready for next handover.`);
        return;
    }
    
    // Invalid submission
    console.log(`[TABot] Invalid adaptive card submission:`, submissionData);
    await context.sendActivity('Invalid response. Please use the provided buttons in the adaptive card.');
};

const checkAndPresentPendingHandovers = async (context: TurnContext, dialogState: any) => {
    if (pendingHandovers.size > 0) {
        const [conversationId, pendingData] = Array.from(pendingHandovers.entries())[0];
        
        console.log(`[TABot] Presenting pending handover from conversation ${conversationId} to TA`);
        
        // Set dialog state for acknowledgment step
        dialogState.step = 'waitingAcknowledgment';
        dialogState.handoverData = pendingData.data;
        dialogState.originalConversationId = conversationId;
        
        // CRITICAL: Save state immediately after setting it
        await taDialogStateAccessor.set(context, dialogState);
        
        console.log(`[TABot] Dialog state set: step=${dialogState.step}, hasHandoverData=${!!dialogState.handoverData}`);
        
        // Remove from pending list
        pendingHandovers.delete(conversationId);
        
        // Send acknowledgment card to TA
        const handoverCard = getTAHandoverCard(pendingData.data.case);
        
        await context.sendActivity({
            attachments: [{
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: handoverCard
            }]
        });
        
        await context.sendActivity('⚠️ **URGENT HANDOVER REQUEST** - Please review the case details above and click "Acknowledge" to proceed.');
        
        console.log(`[TABot] Acknowledgment card presented to TA. Waiting for acknowledgment.`);
    } else {
        await context.sendActivity('No pending handover requests. I\'ll notify you when a new handover request arrives.');
    }
};

// DIAGNOSTIC: Comprehensive Bot Framework behavior analysis
const presentHandoverToTA = async (conversationId: string, handoverData: any) => {
    logOperation('presentHandoverToTA_start', { conversationId, handoverData });
    
    // Store in multiple strategies for comparison
    globalStorage.handover = { conversationId, handoverData, timestamp: Date.now() };
    mapStorage.set('currentHandover', { conversationId, handoverData });
    
    logOperation('storage_updated', { 
        globalHandover: globalStorage.handover,
        mapHandover: mapStorage.get('currentHandover'),
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
                
                // Multiple state access attempts for diagnostic comparison
                let dialogState1, dialogState2, dialogState3;
                
                try {
                    dialogState1 = await taDialogStateAccessor.get(taContext, () => ({ source: 'method1' }));
                    logOperation('state_access_method1_success', dialogState1);
                } catch (e: any) {
                    logOperation('state_access_method1_failed', { error: e?.message || String(e) });
                }
                
                try {
                    dialogState2 = await taDialogStateAccessor.get(taContext);
                    logOperation('state_access_method2_success', dialogState2);
                } catch (e: any) {
                    logOperation('state_access_method2_failed', { error: e?.message || String(e) });
                }
                
                try {
                    dialogState3 = await conversationState.load(taContext);
                    logOperation('state_access_method3_success', dialogState3);
                } catch (e: any) {
                    logOperation('state_access_method3_failed', { error: e?.message || String(e) });
                }
                
                // Use the first successful state access
                const dialogState = dialogState1 || dialogState2 || dialogState3 || { source: 'fallback' };
                
                // Set state with diagnostic tracking
                dialogState.step = 'waitingAcknowledgment';
                dialogState.handoverData = handoverData;
                dialogState.originalConversationId = conversationId;
                dialogState.diagnosticTimestamp = Date.now();
                dialogState.diagnosticId = operationCounter;
                
                logOperation('state_prepared', dialogState);
                
                // Create adaptive card
                const handoverCard = getTAHandoverCard(handoverData.case);
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
                    logOperation('adaptive_card_send_failed', { error: cardError?.message || String(cardError) });
                }
                
                // Send text message
                try {
                    const textResult = await taContext.sendActivity('⚠️ **DIAGNOSTIC HANDOVER** - RCA in progress. Please interact.');
                    logOperation('text_message_sent', { result: textResult });
                } catch (textError: any) {
                    logOperation('text_message_failed', { error: textError?.message || String(textError) });
                }
                
                // Multiple state save attempts
                try {
                    await taDialogStateAccessor.set(taContext, dialogState);
                    logOperation('state_set_success', 'taDialogStateAccessor');
                } catch (e: any) {
                    logOperation('state_set_failed', { method: 'taDialogStateAccessor', error: e?.message || String(e) });
                }
                
                try {
                    await conversationState.saveChanges(taContext);
                    logOperation('state_save_success', 'conversationState');
                } catch (e: any) {
                    logOperation('state_save_failed', { method: 'conversationState', error: e?.message || String(e) });
                }
                
                // Store in global storage for comparison
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

// DIAGNOSTIC: Comprehensive message handler with Bot Framework behavior analysis
const handleTAInteraction = async (context: TurnContext, next: () => Promise<void>) => {
    logOperation('handleTAInteraction_start', {
        messageType: context.activity?.type,
        messageText: context.activity?.text,
        conversationId: context.activity?.conversation?.id,
        channelId: context.activity?.channelId,
        hasValue: !!context.activity?.value,
        activityData: context.activity
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
        currentDialogState = await taDialogStateAccessor.get(context, () => ({ source: 'new' }));
        logOperation('current_state_retrieved', currentDialogState);
    } catch (stateError: any) {
        logOperation('current_state_retrieval_failed', { error: stateError?.message });
        currentDialogState = { source: 'fallback' };
    }
    
    // Check for adaptive card submission
    if (context.activity.type === ActivityTypes.Message && context.activity.value) {
        logOperation('adaptive_card_submission_detected', {
            value: context.activity.value,
            currentState: currentDialogState
        });
        
        await handleAdaptiveCardSubmission(context, context.activity.value);
        return;
    }
    
    // Regular message processing with diagnostic
    if (context.activity.type === ActivityTypes.Message) {
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
            
            await checkAndPresentPendingHandovers(context);
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
            return;
        }
        
        if (messageText.includes('clear')) {
            // Clear all storage for fresh start
            globalStorage.handover = null;
            globalStorage.taContext = null;
            globalStorage.stateHistory = [];
            activeTAConversations.clear();
            pendingHandovers.clear();
            conversationRefs.clear();
            
            currentDialogState = { source: 'cleared' };
            await taDialogStateAccessor.set(context, currentDialogState);
            await conversationState.saveChanges(context);
            
            await context.sendActivity('🧹 All storage cleared for fresh diagnostic.');
            logOperation('storage_cleared', 'all_cleared');
            return;
        }
        
        // Default TA response
        await context.sendActivity('👋 TA Bot diagnostic mode active. Send "status" for diagnostic report, "clear" to reset storage.');
        logOperation('default_ta_response_sent', { messageText });
    }
    
    logOperation('handleTAInteraction_complete', {
        finalState: currentDialogState,
        operationCount: operationCounter
    });
};

// DIAGNOSTIC: Comprehensive adaptive card submission handler
const handleAdaptiveCardSubmission = async (context: TurnContext, submissionData: any) => {
    logOperation('handleAdaptiveCardSubmission_start', {
        submissionData,
        conversationId: context.activity?.conversation?.id
    });
    
    // Multiple state retrieval strategies for diagnostic
    let dialogState;
    try {
        dialogState = await taDialogStateAccessor.get(context, () => ({ source: 'submission_new' }));
        logOperation('submission_state_retrieved_method1', dialogState);
    } catch (e: any) {
        logOperation('submission_state_retrieval_failed', { error: e?.message });
        dialogState = { source: 'submission_fallback', submissionData };
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
        const approvalCard = getTAApprovalCard();
        
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
};

// Keep existing card functions
const getTAHandoverCard = (caseData: any) => {
    return {
        type: 'AdaptiveCard',
        version: '1.3',
        body: [
            {
                type: 'TextBlock',
                text: '🚨 URGENT HANDOVER REQUEST',
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
};

const getTAApprovalCard = () => {
    return {
        type: 'AdaptiveCard',
        version: '1.3',
        body: [
            {
                type: 'TextBlock',
                text: '📋 HANDOVER DECISION',
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
};

// HTTP endpoint for receiving handover requests from UserBot
taServer.post('/api/handover', async (req, res) => {
    logOperation('http_handover_received', req.body);
    
    try {
        const { conversationId, caseData } = req.body;
        await presentHandoverToTA(conversationId, { case: caseData });
        res.send({ success: true, message: 'Handover request processed (diagnostic mode)' });
        logOperation('http_handover_response_sent', { success: true });
    } catch (error: any) {
        logOperation('http_handover_error', { error: error?.message });
        res.status(500).send({ error: 'Failed to process handover request' });
    }
});

// Bot message handler
taBot.onMessage(handleTAInteraction);

// Start the server
const port = process.env.port || process.env.PORT || 3978;
taServer.listen(port, () => {
    console.log(`\n🤖 TA Bot Server (DIAGNOSTIC MODE) listening on port ${port}`);
    console.log(`📊 Comprehensive Bot Framework behavior analysis active`);
    console.log(`🔍 Send "status" to TA bot for diagnostic report`);
    console.log(`🧹 Send "clear" to TA bot to reset all storage`);
});
