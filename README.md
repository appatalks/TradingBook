# TradingBook - Advanced Trading Journal

A comprehensive, open-source trading journal application built with Electron and React. TradingBook provides all the features of premium trading journals like TradingVue, but completely free and with full data ownership.

## 📸 Screenshot

![TradingBook Interface](https://raw.githubusercontent.com/appatalks/TradingBook/main/assets/tradingbook-screenshot.png)

*TradingBook's clean and intuitive interface showing the dashboard with P&L calendar and trade analytics*

## 🚀 Features

### Core Features
- **📊 P&L Calendar**: Visual calendar showing daily profits/losses with color coding
- **📈 Advanced Analytics**: Win rate, profit factor, Sharpe ratio, max drawdown
- **💰 Multi-Asset Support**: Stocks, options, crypto, forex
- **🔍 Trade Management**: Add, edit, delete, search, and filter trades
- **📱 Modern UI**: Clean, responsive interface with dark/light themes

### Why Choose TradingBook?
- ✅ **Completely Free** - No subscription fees
- ✅ **Data Privacy** - Your data stays on your machine
- ✅ **Offline First** - No internet required
- ✅ **Open Source** - Full transparency and customization
- ✅ **Cross Platform** - Works on Linux, Windows, macOS
- ✅ **No Data Limits** - Track unlimited trades

### Technical Advantages
- **🗄️ SQLite Database**: Reliable, fast, embedded database
- **📦 Single File Distribution**: AppImage for easy deployment
- **🔒 Secure**: No data sent to external servers
- **⚡ Fast**: Native desktop performance
- **🎨 Modern Stack**: React, TypeScript, Tailwind CSS

## 📋 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Linux system (other platforms coming soon)

### Installation Options

#### Option 1: Download AppImage (Recommended)
1. Download the latest AppImage from [Releases](https://github.com/appatalks/TradingBook/releases)
2. Make it executable: `chmod +x TradingBook-*.AppImage`
3. Run: `./TradingBook-*.AppImage`

#### Option 2: Build from Source
```bash
# Clone the repository
git clone https://github.com/appatalks/TradingBook.git
cd TradingBook

# Install dependencies
npm install

# Development mode
npm run electron-dev

# Or build AppImage
./build-appimage.sh
```

## 💡 Usage Guide

### Adding Trades
1. Navigate to "New Trade" in the sidebar
2. Fill in trade details (symbol, side, quantity, prices)
3. Add optional information (strategy, notes, option details)
4. Save the trade

### Viewing Analytics
1. Go to "Analytics" to see performance metrics
2. Filter by date ranges
3. View symbol and strategy breakdowns
4. Track win/loss ratios and risk metrics

### P&L Calendar
1. Visit "Dashboard" for the monthly P&L calendar
2. Green days = profit, red days = losses
3. Click on any day to see trade details
4. Navigate between months and years

## 📊 TradingBook vs. TradingVue

| Feature | TradingBook | TradingVue |
|---------|------------|------------|
| **Price** | Free | $49+/month |
| **Data Ownership** | You own it | Cloud-hosted |
| **Internet Required** | No | Yes |
| **Trade Limits** | Unlimited | Plan-dependent |
| **Open Source** | Yes | No |
| **Custom Analytics** | Extensible | Fixed |

## 🔧 Development

### Project Structure
```
TradingBook/
├── public/             # Electron main process
├── src/               # React application
│   ├── components/    # UI components
│   ├── database/      # Database logic
│   └── types/         # TypeScript definitions
├── build/             # Production build
└── dist/              # AppImage output
```

### Scripts
- `npm start` - React development server
- `npm run electron-dev` - Full development mode
- `npm run build` - Build React app
- `npm run electron-build` - Build Electron app
- `./build-appimage.sh` - Create AppImage

### Database
- **Location**: `~/.config/TradingBook/trades.db`
- **Type**: SQLite3 with better-sqlite3
- **Tables**: trades, strategies, settings
- **Schema**: See `src/database/schema.sql`

## 🛣️ Roadmap

### Version 1.1
- [ ] CSV import from major brokers
- [ ] Advanced charting integration
- [ ] Risk management alerts
- [ ] Screenshot annotation tools

### Version 1.2
- [ ] Strategy backtesting
- [ ] Tax reporting features
- [ ] Plugin system
- [ ] Multi-monitor support

### Version 2.0
- [ ] Web version
- [ ] Mobile companion app
- [ ] Optional cloud sync
- [ ] Team/advisor sharing

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙋‍♀️ Support

- **Issues**: [Create a GitHub issue](https://github.com/appatalks/TradingBook/issues)
- **Discussions**: [GitHub Discussions](https://github.com/appatalks/TradingBook/discussions)
- **Security**: Email security@tradingbook.dev

## 🔒 Privacy & Security

- **No Data Collection**: We don't collect any user data
- **Local Storage**: All data stored locally in SQLite
- **No Network Requests**: No data sent to external servers
- **Open Source**: Code is fully auditable

---

**TradingBook** was created because trading journals shouldn't be subscription services. Your trading data is personal and valuable - you should own it completely.

Start tracking your trades like a pro, without the pro subscription fees! 📈
