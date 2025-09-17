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
        title: `Case ${c.caseNumber} | Sev: ${c.severity} | 24/7: ${c.is247 ? 'Yes' : 'No'} | ${c.title}`,
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

export const getConfirmationCard = (caseData: any) => ({
  type: 'AdaptiveCard',
  body: [
    {
      type: 'TextBlock',
      text: `Handover Confirmation`,
      weight: 'Bolder',
      size: 'Medium'
    },
    {
      type: 'FactSet',
      facts: [
        { title: 'Case Number:', value: caseData.caseNumber },
        { title: 'Severity:', value: caseData.severity },
        { title: '24/7 Support:', value: caseData.is247 ? 'Yes' : 'No' },
        { title: 'Title:', value: caseData.title },
        { title: 'Description:', value: caseData.description }
      ]
    },
    {
      type: 'TextBlock',
      text: 'Do you want to proceed with handover?',
      weight: 'Bolder',
      size: 'Small'
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
