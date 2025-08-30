# TradeTrack - Advanced Trading Journal

A comprehensive, open-source trading journal application built with Electron and React. TradeTrack provides all the features of premium trading journals like TradingVue, but completely free and with full data ownership.

## 🚀 Features

### Core Features
- **📊 P&L Calendar**: Visual calendar showing daily profits/losses with color coding
- **📈 Advanced Analytics**: Win rate, profit factor, Sharpe ratio, max drawdown
- **💰 Multi-Asset Support**: Stocks, options, crypto, forex
- **🔍 Trade Management**: Add, edit, delete, search, and filter trades
- **📱 Modern UI**: Clean, responsive interface with dark/light themes

### Superior to TradingVue
- ✅ **Completely Free** - No subscription fees
- ✅ **Data Privacy** - Your data stays on your machine
- ✅ **Offline First** - No internet required
- ✅ **Open Source** - Full transparency and customization
- ✅ **Cross Platform** - Works on Linux, Windows, macOS
- ✅ **No Data Limits** - Track unlimited trades
- ✅ **Advanced Analytics** - More metrics than premium competitors

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

### Installation

1. **Clone and Install**:
```bash
git clone https://github.com/your-repo/trade-track
cd trade-track
npm install
```

2. **Development Mode**:
```bash
npm run electron-dev
```

3. **Build AppImage**:
```bash
./build-appimage.sh
```

4. **Run AppImage**:
```bash
chmod +x dist/TradeTrack-*.AppImage
./dist/TradeTrack-*.AppImage
```

## 💡 Usage

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

## 🗂️ Database Structure

The application uses SQLite with the following main tables:
- `trades`: Core trade data
- `strategies`: Trading strategies
- `tags`: Trade categorization
- `settings`: User preferences

Database location: `~/.config/TradeTrack/trades.db`

## 🎨 Customization

### Adding New Strategies
Strategies are stored in the database and can be managed through the UI or directly in SQLite.

### Theming
The application supports light/dark themes. Toggle through Settings or Ctrl+D.

### Export Formats
Support for CSV, JSON, and Excel exports (Excel coming soon).

## 🔧 Development

### Project Structure
```
trade-track/
├── public/
│   ├── electron.js      # Main Electron process
│   ├── preload.js       # Secure IPC bridge
│   └── index.html       # HTML shell
├── src/
│   ├── components/      # React components
│   ├── database/        # Database logic
│   ├── types/          # TypeScript definitions
│   ├── App.tsx         # Main React app
│   └── index.tsx       # React entry point
├── package.json        # Dependencies and scripts
└── build-appimage.sh   # Build script
```

### Key Scripts
- `npm start`: Run React dev server
- `npm run electron-dev`: Run in development mode
- `npm run build`: Build React app
- `npm run electron-build`: Build Electron app
- `./build-appimage.sh`: Create AppImage

### Database Schema
See `src/database/schema.sql` for the complete database structure.

## 📊 Comparison with TradingVue

| Feature | TradeTrack | TradingVue |
|---------|------------|------------|
| **Price** | Free | $49+/month |
| **Data Ownership** | You own it | Cloud-hosted |
| **Internet Required** | No | Yes |
| **Trade Limits** | Unlimited | Plan-dependent |
| **Open Source** | Yes | No |
| **Custom Analytics** | Extensible | Fixed |
| **Screenshot Support** | Yes | Yes |
| **Multi-Asset** | Yes | Yes |
| **Mobile App** | Desktop-focused | Yes |
| **Cloud Sync** | Local only | Yes |

## 🛣️ Roadmap

### Version 1.1
- [ ] Screenshot annotation tools
- [ ] CSV import from major brokers
- [ ] Advanced charting integration
- [ ] Risk management alerts

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

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙋‍♀️ Support

- **Issues**: Create a GitHub issue
- **Discussions**: Use GitHub Discussions
- **Security**: Email security@tradetrack.dev

## 🔒 Privacy & Security

- **No Data Collection**: We don't collect any user data
- **Local Storage**: All data stored locally in SQLite
- **No Network Requests**: No data sent to external servers
- **Open Source**: Code is fully auditable

## 🚀 Why TradeTrack?

TradeTrack was created because trading journals shouldn't be subscription services. Your trading data is personal and valuable - you should own it completely. We believe in:

- **Privacy First**: Your data, your machine
- **No Vendor Lock-in**: Standard database, exportable data  
- **Community Driven**: Open source, transparent development
- **Professional Grade**: Enterprise-quality features, free forever

Start tracking your trades like a pro, without the pro subscription fees! 📈
