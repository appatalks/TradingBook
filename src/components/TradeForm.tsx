import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Trade } from '../types/Trade';

interface TradeFormProps {
  trades?: Trade[];
  onSubmit: (trade: Omit<Trade, 'id'>, id?: number) => Promise<void>;
  settings?: any;
}

const TradeForm: React.FC<TradeFormProps> = ({ trades = [], onSubmit, settings }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const existingTrade = isEdit ? trades.find(t => t.id === Number(id)) : null;

  // Get pre-filled date from URL parameters
  const getInitialEntryDate = () => {
    const dateParam = searchParams.get('date');
    if (dateParam && !isEdit) {
      // Convert YYYY-MM-DD to datetime-local format (YYYY-MM-DDTHH:MM)
      return `${dateParam}T09:30`; // Default to 9:30 AM market open
    }
    return '';
  };

  const [formData, setFormData] = useState({
    symbol: '',
    side: 'BUY' as 'BUY' | 'SELL' | 'LONG' | 'SHORT',
    quantity: '',
    entryPrice: '',
    exitPrice: '',
    entryDate: getInitialEntryDate(),
    exitDate: '',
    commission: settings?.defaultCommission || '0.00',
    strategy: '',
    notes: '',
    assetType: 'STOCK' as 'STOCK' | 'OPTION' | 'CRYPTO' | 'FOREX',
    optionType: '' as 'CALL' | 'PUT' | '',
    strikePrice: '',
    expirationDate: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update commission when settings change (for new trades only)
  useEffect(() => {
    if (!isEdit && settings?.defaultCommission) {
      setFormData(prev => ({ ...prev, commission: settings.defaultCommission }));
    }
  }, [settings?.defaultCommission, isEdit]);

  useEffect(() => {
    if (existingTrade) {
      // Ensure dates are properly converted
      const entryDate = existingTrade.entryDate instanceof Date 
        ? existingTrade.entryDate 
        : new Date(existingTrade.entryDate);
      const exitDate = existingTrade.exitDate 
        ? (existingTrade.exitDate instanceof Date ? existingTrade.exitDate : new Date(existingTrade.exitDate))
        : null;
      const expirationDate = existingTrade.expirationDate 
        ? (existingTrade.expirationDate instanceof Date ? existingTrade.expirationDate : new Date(existingTrade.expirationDate))
        : null;
      // Helper function to format date for datetime-local input without timezone conversion
      const formatDateForInput = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };
      
      const formatDateOnlyForInput = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
        
      setFormData({
        symbol: existingTrade.symbol || '',
        side: existingTrade.side || 'BUY',
        quantity: (existingTrade.quantity ?? 0).toString(),
        entryPrice: (existingTrade.entryPrice ?? 0).toString(),
        exitPrice: (existingTrade.exitPrice ?? 0) !== 0 ? existingTrade.exitPrice?.toString() || '' : '',
        entryDate: formatDateForInput(entryDate),
        exitDate: exitDate ? formatDateForInput(exitDate) : '',
        commission: (existingTrade.commission ?? 0).toString(),
        strategy: existingTrade.strategy || '',
        notes: existingTrade.notes || '',
        assetType: existingTrade.assetType || 'STOCK',
        optionType: existingTrade.optionType || '',
        strikePrice: (existingTrade.strikePrice ?? 0) !== 0 ? existingTrade.strikePrice?.toString() || '' : '',
        expirationDate: expirationDate ? formatDateOnlyForInput(expirationDate) : ''
      });
    }
  }, [existingTrade]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.symbol.trim()) newErrors.symbol = 'Symbol is required';
    if (!formData.quantity || Number(formData.quantity) <= 0) newErrors.quantity = 'Valid quantity is required';
    if (!formData.entryPrice || Number(formData.entryPrice) <= 0) newErrors.entryPrice = 'Valid entry price is required';
    if (!formData.entryDate) newErrors.entryDate = 'Entry date is required';
    if (!formData.commission || Number(formData.commission) < 0) newErrors.commission = 'Commission must be 0 or greater';

    if (formData.assetType === 'OPTION') {
      if (!formData.optionType) newErrors.optionType = 'Option type is required';
      if (!formData.strikePrice || Number(formData.strikePrice) <= 0) newErrors.strikePrice = 'Strike price is required';
      if (!formData.expirationDate) newErrors.expirationDate = 'Expiration date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculatePnL = () => {
    const quantity = Number(formData.quantity);
    const entryPrice = Number(formData.entryPrice);
    const exitPrice = Number(formData.exitPrice);
    const commission = Number(formData.commission);

    if (!quantity || !entryPrice || !exitPrice) return undefined;

    let pnl = 0;
    if (formData.side === 'BUY' || formData.side === 'LONG') {
      pnl = (exitPrice - entryPrice) * quantity - commission;
    } else {
      pnl = (entryPrice - exitPrice) * quantity - commission;
    }

    return pnl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const tradeData = {
      symbol: formData.symbol.toUpperCase(),
      side: formData.side,
      quantity: Number(formData.quantity),
      entryPrice: Number(formData.entryPrice),
      exitPrice: formData.exitPrice ? Number(formData.exitPrice) : undefined,
      entryDate: new Date(formData.entryDate),
      exitDate: formData.exitDate ? new Date(formData.exitDate) : undefined,
      pnl: calculatePnL(),
      commission: Number(formData.commission),
      strategy: formData.strategy || undefined,
      notes: formData.notes || undefined,
      assetType: formData.assetType,
      optionType: formData.assetType === 'OPTION' && formData.optionType ? formData.optionType as 'CALL' | 'PUT' : undefined,
      strikePrice: formData.assetType === 'OPTION' ? Number(formData.strikePrice) : undefined,
      expirationDate: formData.assetType === 'OPTION' ? new Date(formData.expirationDate) : undefined
    };

    try {
      if (isEdit && existingTrade) {
        await onSubmit(tradeData, existingTrade.id);
      } else {
        await onSubmit(tradeData);
      }
      navigate('/trades');
    } catch (error) {
      console.error('Failed to save trade:', error);
      alert('Failed to save trade. Please try again.');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isEdit ? 'Edit Trade' : 'New Trade'}
        </h1>
        <button
          onClick={() => navigate('/trades')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          Cancel
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Trade Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Symbol
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => handleInputChange('symbol', e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                  errors.symbol ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="AAPL"
              />
              {errors.symbol && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.symbol}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Side
              </label>
              <select
                value={formData.side}
                onChange={(e) => handleInputChange('side', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Asset Type
              </label>
              <select
                value={formData.assetType}
                onChange={(e) => handleInputChange('assetType', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="STOCK">Stock</option>
                <option value="OPTION">Option</option>
                <option value="CRYPTO">Crypto</option>
                <option value="FOREX">Forex</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quantity
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                  errors.quantity ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.quantity && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.quantity}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Entry Price
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.entryPrice}
                onChange={(e) => handleInputChange('entryPrice', e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                  errors.entryPrice ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.entryPrice && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.entryPrice}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Exit Price (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.exitPrice}
                onChange={(e) => handleInputChange('exitPrice', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Entry Date
              </label>
              <input
                type="datetime-local"
                value={formData.entryDate}
                onChange={(e) => handleInputChange('entryDate', e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                  errors.entryDate ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.entryDate && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.entryDate}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Exit Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.exitDate}
                onChange={(e) => handleInputChange('exitDate', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Commission
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.commission}
                onChange={(e) => handleInputChange('commission', e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                  errors.commission ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="0.00"
              />
              {errors.commission && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.commission}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Strategy (Optional)
              </label>
              <input
                type="text"
                value={formData.strategy}
                onChange={(e) => handleInputChange('strategy', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Momentum"
              />
            </div>
          </div>

          {/* Options-specific fields */}
          {formData.assetType === 'OPTION' && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Option Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Option Type
                  </label>
                  <select
                    value={formData.optionType}
                    onChange={(e) => handleInputChange('optionType', e.target.value)}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                      errors.optionType ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <option value="">Select Type</option>
                    <option value="CALL">CALL</option>
                    <option value="PUT">PUT</option>
                  </select>
                  {errors.optionType && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.optionType}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Strike Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.strikePrice}
                    onChange={(e) => handleInputChange('strikePrice', e.target.value)}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                      errors.strikePrice ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.strikePrice && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.strikePrice}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => handleInputChange('expirationDate', e.target.value)}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                      errors.expirationDate ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.expirationDate && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.expirationDate}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Trade notes..."
            />
          </div>

          {/* P&L Preview */}
          {formData.exitPrice && (
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">P&L Preview</h4>
              <div className={`text-lg font-semibold ${
                (calculatePnL() || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {((calculatePnL() || 0) >= 0 ? '+' : '')}${((calculatePnL() || 0)).toFixed(2)}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/trades')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isEdit ? 'Update Trade' : 'Save Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TradeForm;
