# Workflow SDK Frontend

A modern, minimal frontend for the Workflow SDK that allows users to create, submit, and execute workflows on the blockchain.

## Features

- 🔗 **Multi-wallet support** with RainbowKit
- 🎨 **Minimal design** with Tailwind CSS
- 🔧 **Visual workflow builder** with drag-and-drop components
- 📄 **IPFS preview** with formatted JSON display
- 📊 **Transaction history** tracking
- ⚙️ **Configurable presets** for easy setup
- 👥 **Dual mode** - Creator and Executor interfaces

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy the environment variables:
```bash
cp .env.example .env
```

3. Configure your environment variables:
- Get a WalletConnect Project ID from https://cloud.walletconnect.com
- Set your IPFS service URL
- Add contract addresses for each chain
- Configure RPC URLs
- Set the status dashboard URI for workflow monitoring

Example `.env` file:
```bash
VITE_STATUS_DASHBOARD_URI=http://localhost:3003
VITE_APP_NAME=Workflow SDK
VITE_APP_VERSION=1.0.0
```

4. Start the development server:
```bash
npm run dev
```

## Usage

### Creator Mode

1. Connect your wallet
2. Use the visual builder to create a workflow:
   - Set basic info (execution count, validity period)
   - Add triggers (manual, event, or cron)
   - Configure jobs with steps
   - Or use preset templates
3. Review and submit the workflow to blockchain
4. Track your submissions in the transaction history

### Executor Mode

1. Connect your wallet
2. Load available workflows from the blockchain
3. Preview workflow details and IPFS content
4. Execute workflows with a single click
5. Monitor execution results

## Configuration

The app supports configuration through:
- Environment variables (`.env` file)
- Runtime configuration in the UI
- Preset values in `src/config/app.config.ts`

## Architecture

- **State Management**: Zustand with persistence
- **Wallet Connection**: RainbowKit + wagmi
- **Styling**: Tailwind CSS with custom design system
- **Components**: Modular, reusable UI components
- **SDK Integration**: Direct integration with Workflow SDK

## Development

The frontend is built with:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- RainbowKit
- wagmi
- Zustand

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory. 