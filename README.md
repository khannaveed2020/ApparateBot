# ApparateBot 🤖

A Microsoft Teams Bot Framework prototype for automated severity A case handovers with interactive TA approval workflows.

## 🎯 Overview

ApparateBot consists of two coordinated bots that automate the handover process for critical cases:

- **UserBot** (Port 3979): Handles user interactions, case selection, and handover requests
- **TABot** (Port 3978): Manages TA approval workflow with interactive adaptive cards

## ✨ Features

- **Interactive Case Selection**: Users can browse and select cases requiring handover
- **Automated Eligibility Validation**: Only Severity A, 24/7 cases are eligible for handover
- **Real-time TA Notifications**: TAs receive immediate notifications with case details
- **Adaptive Card Workflow**: Rich interactive cards for acknowledge → approve/reject process
- **Comprehensive Logging**: Full diagnostic tracking for monitoring and troubleshooting
- **Bi-directional Communication**: Seamless communication between UserBot and TABot

## 🏗️ Architecture

```
┌─────────────┐    HTTP API    ┌─────────────┐
│   UserBot   │──────────────→│   TABot     │
│ Port 3979   │               │ Port 3978   │
│             │←──────────────│             │
└─────────────┘               └─────────────┘
       │                             │
       ▼                             ▼
┌─────────────────────────────────────┐
│ Bot Framework Emulator              │
│ localhost:4694                      │
└─────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- TypeScript
- Bot Framework Emulator
- Two terminal windows

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/ApparateBot.git
cd ApparateBot
```

2. Install dependencies for both servers:
```bash
# UserBot dependencies
cd user-server
npm install

# TABot dependencies  
cd ../bot-server
npm install
```

### Running the Bots

1. **Start TABot** (Terminal 1):
```bash
cd bot-server
npm start
```
Server starts on `http://localhost:3978`

2. **Start UserBot** (Terminal 2):
```bash
cd user-server  
npm start
```
Server starts on `http://localhost:3979`

3. **Connect Bot Framework Emulator**:
   - UserBot: `http://localhost:3979/api/messages`
   - TABot: `http://localhost:3978/api/messages`

## 🎮 Usage

### User Workflow
1. Connect to UserBot in Bot Framework Emulator
2. Type `handover` to initiate the process
3. Select a case from the adaptive card
4. Confirm handover eligibility
5. Wait for TA response

### TA Workflow  
1. Connect to TABot in Bot Framework Emulator
2. Receive real-time handover notifications
3. Click "Acknowledge" to review case details
4. Approve or Reject with comments
5. Response automatically delivered to user

## 🔧 Configuration

- **UserBot Port**: 3979 (configurable in `user-server/src/index.ts`)
- **TABot Port**: 3978 (configurable in `bot-server/src/index.ts`)
- **Case Data**: Modify sample cases in bot logic for custom scenarios
- **Adaptive Cards**: Customize card templates in respective bot implementations

## 📊 Diagnostic Features

- **Comprehensive Logging**: All operations tracked with timestamps
- **State Management**: Multiple storage strategies for reliability
- **Error Handling**: Robust error management and recovery
- **Status Commands**: Send "status" to TABot for diagnostic reports

## 🏆 Project Status

✅ **Complete and Working**: Full end-to-end functionality implemented
- Inter-bot communication via HTTP APIs
- Interactive adaptive card workflows
- Real-time handover processing
- Comprehensive error handling and logging

## 🛠️ Technology Stack

- **Microsoft Bot Framework**: Core bot functionality
- **TypeScript**: Type-safe development
- **Restify**: HTTP server framework
- **Axios**: HTTP client for inter-bot communication
- **Adaptive Cards**: Rich interactive UI components
- **Bot Framework Emulator**: Local testing environment

## 📋 Sample Workflow

### Case Handover Process:
1. **User Request**: User initiates handover for a Severity A case
2. **Validation**: System validates case eligibility (Severity A + 24/7)
3. **TA Notification**: TABot receives immediate notification with case details
4. **TA Review**: TA acknowledges and reviews case information
5. **Decision**: TA approves or rejects with detailed comments
6. **Response Delivery**: Decision automatically sent back to requesting user

### Sample Case Data:
- **Case 123**: IPsec Tunnel down and BGP down (Production outage)
- **Case 456**: Database connection failures (Critical system impact)
- **Case 789**: API gateway returning 500 errors (Service disruption)

## 🔍 Troubleshooting

### Common Issues:
- **Port conflicts**: Ensure ports 3978 and 3979 are available
- **Bot Framework Emulator**: Download from [Microsoft Bot Framework](https://github.com/microsoft/BotFramework-Emulator)
- **Dependencies**: Run `npm install` in both user-server and bot-server directories

### Debug Commands:
- Send "status" to TABot for comprehensive diagnostic information
- Send "clear" to TABot to reset all storage and state
- Check console logs for detailed operation tracking

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Create a Pull Request

## 📞 Support

For issues and questions, please create an issue in the GitHub repository.

---

Built with ❤️ using Microsoft Bot Framework and TypeScript
