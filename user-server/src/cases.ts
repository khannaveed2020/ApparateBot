export interface Case {
  caseNumber: string;
  severity: string;
  is247: boolean;
  title: string;
  description: string;
}

export const cases: Case[] = [
  {
    caseNumber: '123',
    severity: 'A',
    is247: true,
    title: 'IPsec Tunnel down and BGP down',
    description: 'We have our production tunnel down and our BGP routes are withdrawn due to this and causing outage.'
  },
  {
    caseNumber: '456',
    severity: 'A',
    is247: true,
    title: 'Application Gateway blocking traffic.',
    description: 'Users are getting 403 forbidden even after allowing Geo WAF rules'
  },
  {
    caseNumber: '789',
    severity: 'B',
    is247: false,
    title: 'Latency on the application.',
    description: 'Users are expereincing latency while accessing our application.'
  }
];
