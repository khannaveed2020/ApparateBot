import * as fs from 'fs';
import * as path from 'path';

export interface HandoverReport {
  caseNo: string;
  severity: string;
  sendingEngineer: string;
  vertical: string;
  sap: string;
  valid: boolean;
  rejectReason: string;
  taReviewer: string;
  comments: string;
  timestamp: string;
}

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

export function generateHandoverReport(
  caseData: Case, 
  isValid: boolean, 
  rejectReason: string = '', 
  comments: string = ''
): HandoverReport {
  return {
    caseNo: caseData.caseNumber,
    severity: caseData.severity,
    sendingEngineer: caseData.sendingEngineer,
    vertical: caseData.vertical,
    sap: caseData.sap,
    valid: isValid,
    rejectReason: rejectReason,
    taReviewer: caseData.taReviewer,
    comments: comments,
    timestamp: new Date().toISOString()
  };
}

export function saveHandoverReport(report: HandoverReport): string {
  const now = new Date();
  
  // Format: handover_DDMMYY_HHMMSS.txt
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear().toString().slice(-2);
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  
  const filename = `handover_${day}${month}${year}_${hours}${minutes}${seconds}.txt`;
  
  const content = `Case No: ${report.caseNo}
Severity: ${report.severity}
Sending Engineer: ${report.sendingEngineer}
Vertical: ${report.vertical}
SAP: ${report.sap}
Valid: ${report.valid}
Reject Reason: ${report.rejectReason}
TA/MGR reviewer: ${report.taReviewer}
Comments: ${report.comments}
Timestamp: ${report.timestamp}`;

  // Create handover-reports directory if it doesn't exist
  const reportsDir = path.join(process.cwd(), '..', 'handover-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const filepath = path.join(reportsDir, filename);
  fs.writeFileSync(filepath, content);
  
  console.log(`Handover report saved: ${filepath}`);
  return filepath;
}

export function logHandoverOperation(operation: string, data: any) {
  const timestamp = new Date().toISOString();
  console.log(`[HANDOVER] [${timestamp}] ${operation}:`, JSON.stringify(data, null, 2));
}