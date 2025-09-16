export const getTAHandoverCard = (caseInfo: any) => ({
  type: 'AdaptiveCard',
  body: [
    {
      type: 'TextBlock',
      text: 'A case is pending for handover:',
      weight: 'Bolder',
      size: 'Medium'
    },
    {
      type: 'TextBlock',
      text: `Case Number: ${caseInfo.caseNumber}`
    },
    {
      type: 'TextBlock',
      text: `Severity: ${caseInfo.severity}`
    },
    {
      type: 'TextBlock',
      text: `24/7: ${caseInfo.is247 ? 'Yes' : 'No'}`
    },
    {
      type: 'TextBlock',
      text: `Title: ${caseInfo.title}`
    },
    {
      type: 'TextBlock',
      text: `Description: ${caseInfo.description}`
    }
  ],
  actions: [
    {
      type: 'Action.Submit',
      title: 'Acknowledge',
      data: { action: 'acknowledge' }
    }
  ],
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  version: '1.3'
});

export const getTAApprovalCard = (caseInfo: any) => ({
  type: 'AdaptiveCard',
  body: [
    {
      type: 'TextBlock',
      text: 'Approve or Reject Handover:',
      weight: 'Bolder',
      size: 'Medium'
    },
    {
      type: 'Input.ChoiceSet',
      id: 'decision',
      style: 'expanded',
      choices: [
        { title: 'Approve', value: 'approve' },
        { title: 'Reject', value: 'reject' }
      ]
    },
    {
      type: 'Input.Text',
      id: 'comment',
      placeholder: 'Add a comment'
    }
  ],
  actions: [
    {
      type: 'Action.Submit',
      title: 'Submit'
    }
  ],
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  version: '1.3'
});
