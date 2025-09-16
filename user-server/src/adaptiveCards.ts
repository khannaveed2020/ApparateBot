export const getCaseSelectionCard = (cases: any[]) => ({
  type: 'AdaptiveCard',
  body: [
    {
      type: 'TextBlock',
      text: 'Select a case for handover:',
      weight: 'Bolder',
      size: 'Medium'
    },
    {
      type: 'Input.ChoiceSet',
      id: 'caseNumber',
      style: 'expanded',
      choices: cases.map((c: any) => ({
        title: `Case: ${c.caseNumber}, ${c.title}`,
        value: c.caseNumber
      }))
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

export const getConfirmationCard = (caseNumber: string) => ({
  type: 'AdaptiveCard',
  body: [
    {
      type: 'TextBlock',
      text: `Are you sure you want to handover case ${caseNumber}?`,
      weight: 'Bolder',
      size: 'Medium'
    },
    {
      type: 'Input.ChoiceSet',
      id: 'confirmation',
      style: 'expanded',
      choices: [
        { title: 'Yes', value: 'yes' },
        { title: 'No', value: 'no' }
      ]
    }
  ],
  actions: [
    {
      type: 'Action.Submit',
      title: 'Confirm'
    }
  ],
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  version: '1.3'
});
