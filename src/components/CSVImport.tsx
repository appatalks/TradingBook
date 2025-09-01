import React, { useState, useRef } from 'react';
import { Trade } from '../types/Trade';
import debugLogger from '../utils/debugLogger';

interface CSVImportProps {
  onImport: (trades: Omit<Trade, 'id'>[]) => Promise<void>;
  onClose: () => void;
}

interface SchwabCSVRow {
  Date: string;
  Action: string;
  Symbol: string;
  Description: string;
  Quantity: string;
  Price: string;
  'Fees & Comm': string;
  Amount: string;
}

const CSVImport: React.FC<CSVImportProps> = ({ onImport, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedTrades, setParsedTrades] = useState<Omit<Trade, 'id'>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (csvText: string): SchwabCSVRow[] => {
    debugLogger.log('🔍 parseCSV called with text length:', csvText.length);
    
    const lines = csvText.trim().split('\n');
    debugLogger.log('📋 Total lines found:', lines.length);
    
    if (lines.length < 2) {
      debugLogger.log('❌ Not enough lines in CSV');
      return [];
    }

    const firstLine = lines[0];
    debugLogger.log('📄 First line sample:', firstLine);
    
    // Parse headers - always treat as comma-separated quoted CSV from Schwab
    const headers = firstLine.split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));
    debugLogger.log('📋 Headers found:', headers);
    
    // Check for required Schwab headers
    const requiredHeaders = ['Date', 'Action', 'Symbol', 'Quantity', 'Price'];
    debugLogger.log('🔍 Checking required headers...');
    debugLogger.log('📋 Expected headers:', requiredHeaders);
    debugLogger.log('📋 Found headers:', headers);
    
    const missingRequired = requiredHeaders.filter(required => !headers.includes(required));
    
    if (missingRequired.length > 0) {
      const errorMsg = `Missing required columns: ${missingRequired.join(', ')}. Found headers: ${headers.join(', ')}`;
      console.error('❌ Header validation failed:', errorMsg);
      throw new Error(errorMsg);
    }
    
    debugLogger.log('✅ All required headers found!');
    debugLogger.log('⏳ Processing', lines.length - 1, 'data rows');

    const rows: SchwabCSVRow[] = [];
    
    lines.slice(1).forEach((line, index) => {
      if (!line.trim()) return; // Skip empty lines
      
      debugLogger.log(`🔍 Processing line ${index + 2}: ${line.substring(0, 100)}...`);
      
      // Enhanced CSV parsing for properly quoted fields with embedded commas
      let values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = j + 1 < line.length ? line[j + 1] : '';
        
        if (char === '"' && nextChar === '"') {
          // Handle escaped quotes ("")
          current += '"';
          j++; // Skip next character
        } else if (char === '"') {
          // Toggle quote state
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          // Field separator outside quotes
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Add the last field
      
      debugLogger.log(`📊 Parsed values for line ${index + 2}:`, values.slice(0, 6)); // Show first 6 values
      
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      
      debugLogger.log(`✅ Row object for line ${index + 2}:`, {
        Date: row.Date,
        Action: row.Action,
        Symbol: row.Symbol,
        Quantity: row.Quantity,
        Price: row.Price
      });
      
      rows.push(row as SchwabCSVRow);
    });
    
    debugLogger.log('✅ CSV parsing completed, returning', rows.length, 'rows');
    return rows;
  };

  const convertSchwabRowToTrade = (row: SchwabCSVRow, index: number): Omit<Trade, 'id'> | null => {
    debugLogger.log(`🔍 Processing row ${index + 2}:`, row);
    
    // Skip non-trading actions first
    const action = String(row.Action || '').trim();
    const symbol = String(row.Symbol || '').trim();
    
    debugLogger.log(`📊 Row ${index + 2}: Action="${action}", Symbol="${symbol}"`);
    
    if (!action || !['Buy', 'Sell'].includes(action)) {
      debugLogger.log(`⏭️ Row ${index + 2}: Skipping non-trading action - Action: "${action}"`);
      return null;
    }
    
    if (!symbol) {
      debugLogger.log(`⏭️ Row ${index + 2}: Skipping row with empty symbol - Action: "${action}"`);
      return null;
    }

    try {
      // Parse numeric values with detailed error reporting
      const quantityStr = String(row.Quantity || '').replace(/[,$"]/g, '').trim();
      const quantity = Math.abs(parseFloat(quantityStr) || 0);
      
      const priceStr = String(row.Price || '').replace(/[$,"]/g, '').trim();
      const price = parseFloat(priceStr) || 0;
      
      const commissionStr = String(row['Fees & Comm'] || '').replace(/[$,"]/g, '').trim();
      const commission = parseFloat(commissionStr) || 0;

      debugLogger.log(`Row ${index + 2}: Parsing - Raw Quantity: "${row.Quantity}" -> Clean: "${quantityStr}" -> ${quantity}`);
      debugLogger.log(`Row ${index + 2}: Parsing - Raw Price: "${row.Price}" -> Clean: "${priceStr}" -> ${price}`);
      debugLogger.log(`Row ${index + 2}: Parsing - Raw Commission: "${row['Fees & Comm']}" -> Clean: "${commissionStr}" -> ${commission}`);

      // Validation with specific error messages
      if (quantity === 0) {
        throw new Error(`Invalid quantity: raw="${row.Quantity}", parsed="${quantity}". Must be a positive number.`);
      }
      
      if (price === 0) {
        throw new Error(`Invalid price: raw="${row.Price}", parsed="${price}". Must be a positive number.`);
      }

      // Parse date with better error handling
      let entryDate: Date;
      try {
        const dateStr = String(row.Date || '').trim();
        if (!dateStr) {
          throw new Error('Date field is empty');
        }
        
        debugLogger.log(`Row ${index + 2}: Parsing date - Raw: "${row.Date}" -> Clean: "${dateStr}"`);
        
        // Handle MM/DD/YYYY format from Schwab
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const [month, day, year] = parts.map(p => parseInt(p, 10));
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
              // Create date at 12:00 PM local time to avoid timezone edge cases
              entryDate = new Date(year, month - 1, day, 12, 0, 0, 0);
            } else {
              throw new Error(`Invalid date components: month=${month}, day=${day}, year=${year}`);
            }
          } else {
            throw new Error(`Invalid date format, expected MM/DD/YYYY but got ${parts.length} parts`);
          }
        } else {
          // Fallback to generic Date parsing
          entryDate = new Date(dateStr);
        }
        
        if (isNaN(entryDate.getTime())) {
          throw new Error(`Date parsing resulted in invalid date object`);
        }
        
        debugLogger.log(`Row ${index + 2}: Date parsed successfully - ${entryDate.toDateString()}`);
        
      } catch (dateError) {
        throw new Error(`Date parsing failed: ${dateError instanceof Error ? dateError.message : 'Unknown date error'}`);
      }

      // Determine side and asset type
      const side = action.toUpperCase() as 'BUY' | 'SELL';
      let assetType: 'STOCK' | 'OPTION' | 'CRYPTO' | 'FOREX' = 'STOCK';
      
      const upperSymbol = symbol.toUpperCase();
      if (upperSymbol.includes('/') || ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'].some(curr => upperSymbol.includes(curr))) {
        assetType = 'FOREX';
      } else if (['BTC', 'ETH', 'DOGE', 'ADA', 'SOL'].some(crypto => upperSymbol.includes(crypto))) {
        assetType = 'CRYPTO';
      }

      const trade: Omit<Trade, 'id'> = {
        symbol: upperSymbol,
        side,
        quantity,
        entryPrice: price,
        entryDate,
        commission,
        assetType,
        notes: `Imported from Schwab CSV - ${String(row.Description || '').trim()}`.trim()
      };

      // Debug validation before returning
      debugLogger.log(`🔍 Final trade object for row ${index + 2}:`, trade);
      debugLogger.log(`🔍 Validation check for row ${index + 2}:`, {
        hasSymbol: !!trade.symbol,
        hasSide: !!trade.side,
        hasValidQuantity: trade.quantity > 0,
        hasValidPrice: trade.entryPrice > 0,
        hasValidDate: trade.entryDate && !isNaN(trade.entryDate.getTime())
      });

      debugLogger.log(`✅ Row ${index + 2}: Successfully parsed trade:`, {
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.entryPrice,
        date: trade.entryDate.toISOString(),
        commission: trade.commission
      });

      return trade;
    } catch (error) {
      const errorMsg = `Row ${index + 2} (${action} ${symbol}): ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg, 'Raw row data:', row);
      throw new Error(errorMsg);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrors([]);
      setParsedTrades([]);
      setPreview(false);
    }
  };

  const handleParseFile = async () => {
    if (!file) return;

    setIsLoading(true);
    setErrors([]);

    try {
      const csvText = await file.text();
      debugLogger.log('CSV file content preview (first 300 chars):', csvText.substring(0, 300));
      
      const csvRows = parseCSV(csvText);
      debugLogger.log('Parsed CSV rows count:', csvRows.length);
      debugLogger.log('First row sample:', csvRows[0]);
      
      const trades: Omit<Trade, 'id'>[] = [];
      const parseErrors: string[] = [];

      csvRows.forEach((row, index) => {
        try {
          debugLogger.log(`🔍 Processing row ${index + 2}:`, row);
          const trade = convertSchwabRowToTrade(row, index);
          if (trade) {
            trades.push(trade);
            debugLogger.log(`✅ Row ${index + 2}: Successfully parsed trade for ${trade.symbol}`);
          } else {
            debugLogger.log(`⏭️ Row ${index + 2}: Skipped (non-trading action)`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : `Row ${index + 2}: Unknown error`;
          console.error('❌ Parse error:', errorMsg);
          console.error('Raw row data:', row);
          
          // Add detailed error info to UI
          const detailedError = `Line ${index + 2}: ${errorMsg} | Raw data: ${JSON.stringify(row).substring(0, 200)}`;
          parseErrors.push(detailedError);
        }
      });

      debugLogger.log(`📊 Parsing completed: ${trades.length} successful trades, ${parseErrors.length} errors`);

      if (parseErrors.length > 0) {
        debugLogger.log('🚨 First 10 parsing errors:', parseErrors.slice(0, 10));
        setErrors(parseErrors.slice(0, 20)); // Show first 20 errors to avoid overwhelming UI
      } else {
        setErrors([]);
      }

      setParsedTrades(trades);
      setPreview(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to parse CSV file';
      console.error('💥 CSV parsing failed:', errorMsg);
      setErrors([errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (parsedTrades.length === 0) return;

    setIsLoading(true);
    try {
      await onImport(parsedTrades);
      onClose();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to import trades']);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Import CSV from Schwab
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Upload a CSV file exported from Schwab with trading data. The file should be tab-separated with columns: Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount.
          </p>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* File Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select CSV File
            </label>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <button
                  onClick={handleParseFile}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Parsing...' : 'Parse File'}
                </button>
              )}
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
                Parsing Errors:
              </h3>
              <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside max-h-32 overflow-y-auto">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview */}
          {preview && parsedTrades.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Preview ({parsedTrades.length} trades found)
                </h3>
                <button
                  onClick={handleImport}
                  disabled={isLoading}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? 'Importing...' : `Import ${parsedTrades.length} Trades`}
                </button>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Symbol</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Side</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Quantity</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Price</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Date</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Commission</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {parsedTrades.map((trade, index) => (
                        <tr key={index} className="bg-white dark:bg-gray-800">
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                            {trade.symbol}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              trade.side === 'BUY' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                              {trade.side}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            {trade.quantity}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            ${trade.entryPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            {trade.entryDate.toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            ${trade.commission.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            {trade.assetType}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {preview && parsedTrades.length === 0 && errors.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No valid trades found in the CSV file.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVImport;
