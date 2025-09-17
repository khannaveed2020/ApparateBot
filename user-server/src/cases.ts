export interface Case {
  caseNumber: string;
  severity: string;
  is247: boolean;
  title: string;
  description: string;
  vertical: string;
  sap: string;
  sendingEngineer: string;
  taReviewer: string;
}

export const cases: Case[] = [
  {
    caseNumber: '123',
    severity: 'A',
    is247: true,
    title: 'IPsec Tunnel down and BGP down',
    description: 'We have our production tunnel down and our BGP routes are withdrawn due to this and causing outage.',
    vertical: 'Hybrid',
    sap: 'Azure/VPN Gateway/Connectivity/Site-to-site VPN connectivity issues.',
    sendingEngineer: 'Naveed Khan',
    taReviewer: 'Ravi Kumar'
  },
  {
    caseNumber: '456',
    severity: 'A',
    is247: true,
    title: 'Application Gateway blocking traffic.',
    description: 'Users are getting 403 forbidden even after allowing Geo WAF rules.',
    vertical: 'Layer7',
    sap: 'Azure/Application Gateway/Facing 4xx errors/Other 4xx errors.',
    sendingEngineer: 'Harshdeep',
    taReviewer: 'Ratnavo Dutta'
  },
  {
    caseNumber: '789',
    severity: 'B',
    is247: false,
    title: 'Latency on the application.',
    description: 'Users are experiencing latency while accessing our application.',
    vertical: 'Hybrid',
    sap: 'Azure/ExpressRoute/ExpressRoute Private Peering/Latency on link',
    sendingEngineer: 'Rajiv',
    taReviewer: 'N/A'
  }
];
