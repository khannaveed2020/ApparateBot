## Enhanced Handover Criteria Feedback Test

The UserBot has been enhanced to provide specific feedback when cases don't meet handover criteria.

### Previous Behavior:
- Generic message: "The case does not match handover criteria"
- No explanation of why the case failed

### New Behavior:
- Specific reasons why case fails validation
- Clear indication of requirements

### Test Case 789:
- **Severity**: 'B' (fails - requires 'A')  
- **is247**: false (fails - requires true)

**Expected Message**: 
"The case does not match handover criteria: Case severity is 'B' (requires 'A') and Case is not marked as 24/7 support. Only Severity A cases with 24/7 support are eligible for handover."

### Test Case Examples:

**Case with Severity B only:**
- Message: "Case severity is 'B' (requires 'A')"

**Case without 24/7 support only:**  
- Message: "Case is not marked as 24/7 support"

**Case failing both criteria:**
- Message: "Case severity is 'B' (requires 'A') and Case is not marked as 24/7 support"

### How to Test:
1. Open Bot Framework Emulator
2. Connect to UserBot (http://localhost:3979/api/messages)
3. Say "list cases" 
4. Select case 789
5. Confirm handover with "yes"
6. Observe the detailed feedback message

### Logging Enhancement:
The system now also logs detailed failure reasons in the `handover_ineligible` operation for better debugging and analytics.