# Contributing to TradingBook

Thank you for your interest in contributing to TradingBook! This document outlines the guidelines for contributing to this project.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/TradingBook.git
   cd TradingBook
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start development**:
   ```bash
   npm run electron-dev
   ```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ 
- npm 8+
- Git
- Linux (for AppImage builds)

### Development Commands
```bash
npm start              # React development server only
npm run electron-dev   # Full Electron development mode
npm run build          # Production build
npm run build-appimage # Build Linux AppImage
npm test               # Run tests
npx tsc --noEmit      # TypeScript type checking
```

## 📝 Coding Standards

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow the existing code style (Prettier configuration)
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Always handle errors gracefully

### React Components
- Use functional components with hooks
- Prefer TypeScript interfaces for props
- Implement proper error boundaries
- Use React.memo() for performance when needed

### Database Operations
- Always use prepared statements
- Convert `undefined` to `null` for SQLite
- Handle Date objects properly (convert to ISO strings)
- Wrap operations in try-catch blocks

### Electron Security
- Never disable context isolation
- Use preload scripts for IPC communication
- Validate all data from renderer process

## 🐛 Bug Reports

When reporting bugs, please include:
- **Operating System** and version
- **Node.js version** (`node --version`)
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Console errors** (if any)
- **Screenshots** (if applicable)

Use the bug report template when creating issues.

## ✨ Feature Requests

Before submitting feature requests:
1. Check if the feature already exists
2. Search existing issues and discussions
3. Consider if the feature aligns with the project goals
4. Provide clear use cases and benefits

## 🔄 Pull Request Process

### Before Submitting
1. **Create an issue** first to discuss the change
2. **Fork the repository** and create a feature branch
3. **Follow the coding standards** outlined above
4. **Write/update tests** for your changes
5. **Test thoroughly** in both development and production modes
6. **Update documentation** if needed

### PR Requirements
- Clear, descriptive title
- Detailed description of changes
- Link to related issue(s)
- Screenshots for UI changes
- All tests passing
- TypeScript compilation without errors

### Review Process
1. Automated CI checks must pass
2. Code review by maintainers
3. Testing by maintainers (if needed)
4. Merge to main branch

## 🧪 Testing

### Types of Testing
- **Unit tests**: Individual functions and components
- **Integration tests**: Database operations and IPC
- **Manual testing**: Full application workflows
- **AppImage testing**: Built packages on clean systems

### Testing Guidelines
- Write tests for new features
- Update tests when modifying existing code
- Test both success and error scenarios
- Verify database operations don't corrupt data

## 📚 Documentation

### What to Document
- New features and their usage
- API changes
- Breaking changes
- Installation/setup procedures
- Troubleshooting guides

### Where to Document
- **README.md**: Basic setup and usage
- **copilot-instructions.md**: Development guidelines
- **Code comments**: Complex logic explanation
- **GitHub Issues**: Bug reports and feature discussions

## 🎯 Project Goals

TradingBook aims to be:
- **Privacy-focused**: All data stays local
- **Professional-grade**: Enterprise-quality features
- **Free and open-source**: No subscription fees
- **Cross-platform**: Works on Linux, Windows, macOS
- **Offline-first**: No internet dependency

Keep these goals in mind when contributing.

## 🆘 Getting Help

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Code Review**: Comments on pull requests

## 📄 License

By contributing to TradingBook, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes (for significant contributions)
- README.md acknowledgments

## 📞 Contact

- **GitHub**: [@appatalks](https://github.com/appatalks)
- **Issues**: Use GitHub Issues for project-related questions

Thank you for contributing to TradingBook! 🚀
