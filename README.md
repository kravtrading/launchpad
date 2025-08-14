# KravTrade Solana Launchpad

A comprehensive Solana smart contract system for secure token launches, presale management, and investor participation with built-in vesting mechanisms.

## 🚀 Features

- **Token Launch Creation**: Create and configure token sales with customizable parameters
- **Secure Presales**: Manage fundraising campaigns with contribution limits and time windows
- **Vesting Schedules**: Implement time-locked token distribution with cliff periods and linear releases
- **Administrative Controls**: Platform governance with approval workflows and emergency controls
- **Fee Management**: Automated platform fee collection and fund distribution
- **Investor Protection**: Refund mechanisms for failed launches and secure escrow
- **TypeScript SDK**: Complete client library for easy integration
- **Comprehensive Testing**: Full test suite with unit and integration tests

## 🏗️ Architecture

The launchpad consists of multiple interconnected components:

- **Launchpad Program**: Core functionality for launch creation and management
- **Token Integration**: SPL Token program integration for mint operations
- **Vesting System**: Time-locked token distribution mechanisms
- **Admin Controls**: Platform governance and administrative functions

### Key Components

- **Platform Configuration**: Global settings and fee structure
- **Launch Configuration**: Individual launch parameters and state
- **Investor Accounts**: User participation data and allocations
- **Vesting Accounts**: Time-locked token release schedules
- **Treasury Management**: Secure fund handling and fee collection

## 📋 Prerequisites

- [Rust](https://rustup.rs/) 1.70.0+
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) 1.16.0+
- [Anchor Framework](https://www.anchor-lang.com/docs/installation) 0.29.0+
- [Node.js](https://nodejs.org/) 18.0.0+
- [Yarn](https://yarnpkg.com/) or npm

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kravtrading/launchpad.git
   cd launchpad/contracts
   ```

2. **Install dependencies**
   ```bash
   yarn install
   # or
   npm install
   ```

3. **Build the program**
   ```bash
   anchor build
   ```

4. **Generate program keypair (if needed)**
   ```bash
   solana-keygen new -o target/deploy/kravtrade_launchpad-keypair.json
   ```

5. **Update program ID**
   ```bash
   anchor keys list
   # Update the program ID in Anchor.toml and lib.rs
   ```

## 🚀 Quick Start

### 1. Start Local Validator

```bash
solana-test-validator
```

### 2. Deploy to Localnet

```bash
# Build and deploy
anchor build
anchor deploy

# Initialize platform
npm run deploy:script deploy
```

### 3. Run Tests

```bash
# Run all tests
anchor test

# Run specific test file
anchor test --skip-deploy tests/kravtrade-launchpad.ts
```

### 4. Monitor Platform

```bash
# Generate health report
npm run monitor health

# Monitor specific launch
npm run monitor launch 1

# Start continuous monitoring
npm run monitor start
```

## 📖 Usage Examples

### Creating a Launch

```typescript
import { LaunchpadSDK } from './sdk/launchpad-sdk';
import { Connection, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Initialize SDK
const connection = new Connection('http://127.0.0.1:8899');
const wallet = new Wallet(creatorKeypair);
const sdk = LaunchpadSDK.create(connection, wallet, {
  programId: new PublicKey('YOUR_PROGRAM_ID'),
});

// Create launch parameters
const launchParams = {
  launchId: new BN(1),
  name: "Example Token",
  symbol: "EXAMPLE",
  decimals: 9,
  totalSupply: new BN(1_000_000 * 10**9),
  presalePrice: new BN(0.1 * LAMPORTS_PER_SOL),
  minContribution: new BN(0.01 * LAMPORTS_PER_SOL),
  maxContribution: new BN(10 * LAMPORTS_PER_SOL),
  softCap: new BN(1 * LAMPORTS_PER_SOL),
  hardCap: new BN(10 * LAMPORTS_PER_SOL),
  startTime: new BN(Math.floor(Date.now() / 1000) + 3600),
  endTime: new BN(Math.floor(Date.now() / 1000) + 7 * 24 * 3600),
  vestingConfig: {
    cliffDuration: new BN(0),
    vestingDuration: new BN(30 * 24 * 3600),
    initialUnlockPercentage: 1000, // 10%
    isLinear: true,
  },
  metadata: {
    description: "Revolutionary DeFi token",
    website: "https://example.com",
    twitter: "@example",
    telegram: "https://t.me/example",
    discord: "https://discord.gg/example",
    logoUri: "https://example.com/logo.png",
    documentation: "https://docs.example.com",
  },
};

// Create the launch
const tokenMint = Keypair.generate();
const result = await sdk.createLaunch(launchParams, creatorKeypair, tokenMint);
console.log('Launch created:', result.signature);
```

### Contributing to a Launch

```typescript
// Contribute to launch
const contributionAmount = new BN(0.5 * LAMPORTS_PER_SOL);
const result = await sdk.contribute(
  new BN(1), // launch ID
  contributionAmount,
  investorKeypair
);
console.log('Contribution successful:', result.signature);
```

### Claiming Tokens

```typescript
// Claim vested tokens
const result = await sdk.claimTokens(
  new BN(1), // launch ID
  investorKeypair
);
console.log('Tokens claimed:', result.signature);
```

## 🧪 Testing

The project includes comprehensive tests covering:

- Platform initialization and configuration
- Launch creation and validation
- Investor contributions and limits
- Token claiming and vesting
- Administrative controls
- Error conditions and edge cases

### Running Tests

```bash
# Run all tests
anchor test

# Run with verbose output
anchor test --skip-deploy -- --reporter spec

# Run specific test suite
anchor test --skip-deploy tests/kravtrade-launchpad.ts
```

### Test Coverage

- ✅ Platform initialization
- ✅ Launch creation and approval
- ✅ Investor contributions
- ✅ Token claiming and vesting
- ✅ Refund mechanisms
- ✅ Administrative controls
- ✅ Error handling
- ✅ Security validations

## 🔧 Configuration

### Environment Configuration

Create configuration files for different environments:

**`config/localnet.json`**
```json
{
  "cluster": "localnet",
  "platformFeePercentage": 250,
  "minLaunchDuration": 86400,
  "maxLaunchDuration": 2592000,
  "minSoftCap": 1000000000
}
```

**`config/devnet.json`**
```json
{
  "cluster": "devnet",
  "platformFeePercentage": 250,
  "minLaunchDuration": 86400,
  "maxLaunchDuration": 2592000,
  "minSoftCap": 1000000000
}
```

### Deployment Configuration

Update `Anchor.toml` with your program IDs:

```toml
[programs.localnet]
kravtrade_launchpad = "YOUR_PROGRAM_ID"

[programs.devnet]
kravtrade_launchpad = "YOUR_PROGRAM_ID"

[programs.mainnet]
kravtrade_launchpad = "YOUR_PROGRAM_ID"
```

## 📚 Documentation

- [API Documentation](./docs/API.md) - Complete API reference
- [Architecture Guide](./docs/ARCHITECTURE.md) - System architecture overview
- [Security Guide](./docs/SECURITY.md) - Security considerations and best practices
- [Integration Guide](./docs/INTEGRATION.md) - How to integrate with the launchpad

## 🔐 Security

The launchpad implements multiple security measures:

- **Access Control**: Role-based permissions with proper authorization checks
- **Input Validation**: Comprehensive validation and sanitization
- **Arithmetic Safety**: Overflow protection for all calculations
- **Reentrancy Protection**: Secure state management
- **Time-based Security**: Validation of time-based operations
- **Fund Security**: Secure escrow mechanisms

### Security Audits

- [ ] Internal security review
- [ ] External security audit
- [ ] Bug bounty program

## 🚀 Deployment

### Local Development

```bash
# Start local validator
solana-test-validator

# Deploy to local
anchor build
anchor deploy
npm run deploy:script deploy
```

### Devnet Deployment

```bash
# Configure for devnet
solana config set --url devnet

# Deploy to devnet
CLUSTER=devnet anchor deploy
CLUSTER=devnet npm run deploy:script deploy
```

### Mainnet Deployment

```bash
# Configure for mainnet
solana config set --url mainnet-beta

# Deploy to mainnet (use with caution)
CLUSTER=mainnet anchor deploy
CLUSTER=mainnet npm run deploy:script deploy
```

## 📊 Monitoring

The platform includes comprehensive monitoring tools:

```bash
# Health check
npm run monitor health

# Monitor specific launch
npm run monitor launch <launch_id>

# Continuous monitoring
npm run monitor start
```

### Monitoring Features

- Platform health checks
- Launch activity monitoring
- Performance metrics
- Error tracking and alerting
- Automated reporting

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style

- Follow Rust best practices
- Use meaningful variable names
- Add comprehensive comments
- Include proper error handling
- Write tests for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check our [docs](./docs/) directory
- **Issues**: Report bugs on [GitHub Issues](https://github.com/kravtrading/launchpad/issues)
- **Email**: Contact us at support@krav.trading

## 🗺️ Roadmap

- [x] Core launchpad functionality
- [x] Vesting mechanisms
- [x] Administrative controls
- [x] TypeScript SDK
- [x] Comprehensive testing
- [ ] Advanced vesting schedules
- [ ] Multi-token support
- [ ] Governance integration
- [ ] Mobile SDK
- [ ] Analytics dashboard

## ⚠️ Disclaimer

This software is provided "as is" without warranty of any kind. Use at your own risk. Always conduct thorough testing before deploying to mainnet.

## 🙏 Acknowledgments

- [Anchor Framework](https://www.anchor-lang.com/) for the excellent Solana development framework
- [Solana Labs](https://solana.com/) for the high-performance blockchain
- The Solana developer community for inspiration and support

---

**Built with ❤️ by the KravTrade Team**