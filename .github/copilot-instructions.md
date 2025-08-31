# GitHub Copilot Instructions for TradingBook

## Project Overview
TradingBook is an advanced trading journal application built with Electron, React, and TypeScript. It provides comprehensive trade tracking, analytics, and portfolio management capabilities with a focus on privacy and offline functionality.

## Architecture Guidelines

### Core Technologies
- **Frontend**: React 18 with TypeScript
- **Backend**: Electron main process with Node.js
- **Database**: SQLite3 with better-sqlite3
- **Styling**: Tailwind CSS
- **Build**: electron-builder for AppImage creation
- **Charts**: Chart.js with react-chartjs-2

### Code Style Preferences

#### React Components
- Use functional components with hooks
- Prefer TypeScript interfaces over types for props
- Use proper error boundaries for database operations
- Always handle loading and error states
- Use React.memo() for performance optimization when needed

```typescript
interface ComponentProps {
  trades: Trade[];
  onUpdate: (id: number, trade: Partial<Trade>) => Promise<void>;
}

const Component: React.FC<ComponentProps> = ({ trades, onUpdate }) => {
  // Implementation
};
```

#### Database Operations
- Always use proper type conversion for SQLite3
- Convert `undefined` to `null` using nullish coalescing (`?? null`)
- Convert Date objects to ISO strings for storage
- Use prepared statements for all queries
- Wrap database operations in try-catch blocks

```javascript
const result = stmt.run(
  trade.symbol,
  trade.quantity,
  trade.entryPrice,
  trade.exitPrice ?? null,
  trade.entryDate instanceof Date ? trade.entryDate.toISOString() : trade.entryDate
);
```

#### Electron Security
- Always use `contextIsolation: true`
- Never enable `nodeIntegration` in renderer
- Use preload scripts for secure IPC communication
- Validate all data received from renderer process

### Navigation
- Use `MemoryRouter` for Electron compatibility
- Never use `window.location.href` - always use React Router's `navigate()`
- Handle external link navigation in main process

### Error Handling
- Log all errors to console with context
- Show user-friendly error messages
- Gracefully handle database connection failures
- Implement retry mechanisms for critical operations

## File Organization

### Directory Structure
```
src/
├── components/          # React components
├── database/           # Database operations and schema
├── types/             # TypeScript type definitions
└── App.tsx           # Main application component

public/
├── electron.js       # Electron main process
└── preload.js       # Preload script for secure IPC
```

### Naming Conventions
- Components: PascalCase (e.g., `TradeForm.tsx`)
- Files: camelCase for utilities, PascalCase for components
- Database fields: snake_case (converted from camelCase)
- Constants: UPPER_SNAKE_CASE

## Database Schema

### Trade Entity
```sql
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL', 'LONG', 'SHORT')),
  quantity REAL NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL,
  entry_date TEXT NOT NULL,
  exit_date TEXT,
  pnl REAL,
  commission REAL DEFAULT 0,
  strategy TEXT,
  notes TEXT,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('STOCK', 'OPTION', 'CRYPTO', 'FOREX'))
);
```

## Testing Guidelines

### What to Test
- Database CRUD operations
- Form validation
- Navigation between routes
- Error handling scenarios
- AppImage build process

### Testing Tools
- Jest for unit tests
- React Testing Library for component tests
- Manual testing for Electron-specific features

## Performance Considerations

### Database
- Use prepared statements for repeated queries
- Index frequently queried columns
- Batch operations when possible
- Close database connections properly

### React
- Use `React.memo()` for expensive components
- Implement virtual scrolling for large trade lists
- Debounce search inputs
- Lazy load non-critical components

## Security Best Practices

### Electron Security
- Never disable context isolation
- Validate all IPC messages
- Use `allowRunningInsecureContent: false`
- Implement CSP headers where appropriate

### Data Protection
- Store data locally only
- No external API calls without user consent
- Encrypt sensitive data if needed
- Clear clipboard after copying sensitive info

## Build and Deployment

### Development
```bash
npm start                # React development server
npm run electron-dev     # Full development mode
```

### Production
```bash
npm run build           # Build React app
npm run build-appimage  # Create optimized Linux AppImage (~113MB)
```

### AppImage Optimizations Applied
- Dependencies moved to devDependencies for smaller bundle
- Unused dependencies removed (date-fns, electron-store)
- Locale optimization (English, Ukrainian, European languages only)
- Minimal compression for faster startup times
- Source maps excluded from production build

### AppImage Requirements
- Clean install dependencies before building: `rm -rf node_modules && npm install`
- Test on clean Linux systems
- Verify file permissions are correct: `chmod +x dist/*.AppImage`
- Final size optimized to ~113MB (down from 160MB)

### Build Process
1. Remove old artifacts: `rm -rf dist/`
2. Build React app: `npm run build`
3. Package Electron app: `electron-builder --linux AppImage`
4. Test AppImage: `./dist/TradingBook-*.AppImage`

## Common Patterns

### Form Handling
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) return;
  
  const tradeData = {
    symbol: formData.symbol.toUpperCase(),
    quantity: Number(formData.quantity),
    entryDate: new Date(formData.entryDate),
    // Convert undefined to null for database
    exitPrice: formData.exitPrice ? Number(formData.exitPrice) : null
  };
  
  try {
    await onSubmit(tradeData);
    navigate('/trades');
  } catch (error) {
    console.error('Failed to save trade:', error);
    setError('Failed to save trade. Please try again.');
  }
};
```

### Database Queries
```javascript
getTrades(filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      let sql = 'SELECT * FROM trades WHERE 1=1';
      const params = [];
      
      if (filters.symbol) {
        sql += ' AND symbol LIKE ?';
        params.push(`%${filters.symbol}%`);
      }
      
      const stmt = this.db.prepare(sql);
      const trades = stmt.all(...params);
      resolve(trades);
    } catch (err) {
      reject(err);
    }
  });
}
```

## Debugging Tips

### Common Issues
1. **SQLite binding errors**: Always convert undefined to null
2. **Navigation errors**: Use React Router's navigate(), not window.location
3. **Build failures**: Check that all native deps are properly rebuilt
4. **IPC errors**: Verify preload script is loaded correctly

### Debugging Commands
```bash
# Debug Electron main process
npm run electron-dev -- --inspect=9229

# Debug renderer process  
# Use Chrome DevTools in the Electron window

# Check SQLite operations
# Add console.log statements in Database.js
```

## Feature Development Guidelines

### Adding New Features
1. Update TypeScript interfaces first
2. Modify database schema if needed
3. Implement backend IPC handlers
4. Create/update React components
5. Add proper error handling
6. Test in both dev and production modes
7. Update documentation

### Code Review Checklist
- [ ] TypeScript types are properly defined
- [ ] Database operations handle null values
- [ ] React Router navigation is used correctly
- [ ] Error handling is implemented
- [ ] No security vulnerabilities introduced
- [ ] Code follows established patterns
- [ ] Tests are updated/added if needed

Remember: TradingBook prioritizes user privacy, offline functionality, and professional-grade features. All code should reflect these values.
