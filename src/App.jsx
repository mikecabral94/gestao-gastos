import { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  FiPlus, FiTrash2, FiEdit2, FiX, FiDollarSign, FiTarget,
  FiTrendingUp, FiCalendar, FiFilter, FiCheck, FiAlertCircle,
  FiSettings, FiPieChart, FiLoader, FiChevronLeft, FiChevronRight
} from 'react-icons/fi';

// Pagination config
const ITEMS_PER_PAGE = 10;

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// API Base URL
const API_URL = 'http://localhost:3002/api';

// LocalStorage keys
const STORAGE_KEYS = {
  expenses: 'gestao-gastos-expenses',
  budgets: 'gestao-gastos-budgets',
};

// LocalStorage helpers
const storage = {
  getExpenses: () => JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || '[]'),
  setExpenses: (expenses) => localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses)),
  getBudgets: () => JSON.parse(localStorage.getItem(STORAGE_KEYS.budgets) || '{}'),
  setBudgets: (budgets) => localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(budgets)),
};

// Check if API is available
const checkApiAvailable = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

// Categories with colors
const CATEGORIES = [
  { id: 'alimentacao', name: 'Alimentacao', color: '#f97316', bgColor: 'bg-orange-500', icon: '🍔' },
  { id: 'transporte', name: 'Transporte', color: '#3b82f6', bgColor: 'bg-blue-500', icon: '🚗' },
  { id: 'habitacao', name: 'Habitacao', color: '#8b5cf6', bgColor: 'bg-purple-500', icon: '🏠' },
  { id: 'saude', name: 'Saude', color: '#ef4444', bgColor: 'bg-red-500', icon: '💊' },
  { id: 'lazer', name: 'Lazer', color: '#ec4899', bgColor: 'bg-pink-500', icon: '🎬' },
  { id: 'compras', name: 'Compras', color: '#eab308', bgColor: 'bg-yellow-500', icon: '🛒' },
  { id: 'contas', name: 'Contas', color: '#6366f1', bgColor: 'bg-indigo-500', icon: '📄' },
  { id: 'outros', name: 'Outros', color: '#6b7280', bgColor: 'bg-gray-500', icon: '📦' },
];

// Format currency
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

// Get month name
const getMonthName = (date) => {
  return new Date(date).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
};

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-up ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-gray-800 text-white'
    }`}>
      {type === 'success' && <FiCheck size={20} />}
      {type === 'error' && <FiAlertCircle size={20} />}
      <span className="font-medium">{message}</span>
    </div>
  );
};

function App() {
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [useApi, setUseApi] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterCategory, setFilterCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'alimentacao',
    date: new Date().toISOString().split('T')[0],
  });
  const [budgetInput, setBudgetInput] = useState('');

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Fetch expenses (API or localStorage)
  const fetchExpenses = useCallback(async (apiAvailable = useApi) => {
    try {
      if (apiAvailable) {
        const params = new URLSearchParams();
        if (selectedMonth) params.append('month', selectedMonth);
        if (filterCategory) params.append('category', filterCategory);

        const response = await fetch(`${API_URL}/expenses?${params}`);
        const data = await response.json();
        setExpenses(data);
      } else {
        // Use localStorage
        let data = storage.getExpenses();
        if (selectedMonth) {
          data = data.filter((e) => e.date.startsWith(selectedMonth));
        }
        if (filterCategory) {
          data = data.filter((e) => e.category === filterCategory);
        }
        data.sort((a, b) => new Date(b.date) - new Date(a.date));
        setExpenses(data);
      }
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
    }
  }, [selectedMonth, filterCategory, useApi]);

  // Fetch budget (API or localStorage)
  const fetchBudget = useCallback(async (apiAvailable = useApi) => {
    try {
      if (apiAvailable) {
        const response = await fetch(`${API_URL}/budgets/${selectedMonth}`);
        const data = await response.json();
        setBudget(data.amount || 0);
      } else {
        // Use localStorage
        const budgets = storage.getBudgets();
        setBudget(budgets[selectedMonth] || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar orcamento:', error);
    }
  }, [selectedMonth, useApi]);

  // Check API availability and load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const apiAvailable = await checkApiAvailable();
      setUseApi(apiAvailable);
      await Promise.all([fetchExpenses(apiAvailable), fetchBudget(apiAvailable)]);
      setLoading(false);
    };
    loadData();
  }, [fetchExpenses, fetchBudget]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, filterCategory]);

  // Calculate totals
  const monthlyTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBudget = budget - monthlyTotal;
  const budgetPercentage = budget > 0 ? Math.min((monthlyTotal / budget) * 100, 100) : 0;

  // Calculate by category for chart
  const categoryTotals = CATEGORIES.map((cat) => {
    const total = expenses
      .filter((e) => e.category === cat.id)
      .reduce((sum, e) => sum + e.amount, 0);
    return { ...cat, total };
  }).filter((cat) => cat.total > 0);

  // Get available months (last 12 months)
  const getAvailableMonths = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(date.toISOString().slice(0, 7));
    }
    return months;
  };

  const availableMonths = getAvailableMonths();

  // Chart data for Doughnut
  const doughnutData = {
    labels: categoryTotals.map((c) => c.name),
    datasets: [{
      data: categoryTotals.map((c) => c.total),
      backgroundColor: categoryTotals.map((c) => c.color),
      borderWidth: 0,
      cutout: '70%',
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw;
            const percentage = monthlyTotal > 0 ? ((value / monthlyTotal) * 100).toFixed(1) : 0;
            return `${formatCurrency(value)} (${percentage}%)`;
          },
        },
      },
    },
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!formData.description || !amount || amount <= 0) {
      showToast('Preencha todos os campos correctamente', 'error');
      return;
    }

    try {
      if (useApi) {
        if (editingId) {
          const response = await fetch(`${API_URL}/expenses/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, amount }),
          });
          if (!response.ok) throw new Error('Erro ao atualizar');
        } else {
          const response = await fetch(`${API_URL}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, amount }),
          });
          if (!response.ok) throw new Error('Erro ao criar');
        }
      } else {
        // Use localStorage
        const allExpenses = storage.getExpenses();
        if (editingId) {
          const index = allExpenses.findIndex((e) => e.id === editingId);
          if (index !== -1) {
            allExpenses[index] = { ...allExpenses[index], ...formData, amount };
          }
        } else {
          const newExpense = {
            id: Date.now(),
            ...formData,
            amount,
            created_at: new Date().toISOString(),
          };
          allExpenses.push(newExpense);
        }
        storage.setExpenses(allExpenses);
      }

      showToast(editingId ? 'Despesa atualizada com sucesso' : 'Despesa adicionada com sucesso');
      closeModal();
      fetchExpenses();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Handle budget save
  const handleBudgetSave = async () => {
    try {
      const newBudget = parseFloat(budgetInput) || 0;

      if (useApi) {
        const response = await fetch(`${API_URL}/budgets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: selectedMonth, amount: newBudget }),
        });
        if (!response.ok) throw new Error('Erro ao guardar orcamento');
      } else {
        // Use localStorage
        const budgets = storage.getBudgets();
        budgets[selectedMonth] = newBudget;
        storage.setBudgets(budgets);
      }

      setBudget(newBudget);
      setShowBudgetModal(false);
      showToast('Orcamento definido com sucesso');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Open modal for new expense
  const openNewExpense = () => {
    setEditingId(null);
    setFormData({
      description: '',
      amount: '',
      category: 'alimentacao',
      date: new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  // Open modal for editing
  const openEditExpense = (expense) => {
    setEditingId(expense.id);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: expense.date,
    });
    setShowModal(true);
  };

  // Open budget modal
  const openBudgetModal = () => {
    setBudgetInput(budget.toString());
    setShowBudgetModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  // Delete expense
  const deleteExpense = async (id) => {
    if (!confirm('Tem certeza que deseja eliminar esta despesa?')) return;

    try {
      if (useApi) {
        const response = await fetch(`${API_URL}/expenses/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Erro ao eliminar');
      } else {
        // Use localStorage
        const allExpenses = storage.getExpenses();
        const filtered = allExpenses.filter((e) => e.id !== id);
        storage.setExpenses(filtered);
      }

      showToast('Despesa eliminada');
      fetchExpenses();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Get category info
  const getCategoryInfo = (categoryId) => {
    return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[7];
  };

  // Get last 5 expenses for dashboard
  const recentExpenses = expenses.slice(0, 5);

  // Pagination logic
  const totalPages = Math.ceil(expenses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedExpenses = expenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Get page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <FiLoader className="animate-spin text-primary-500" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
                <FiDollarSign className="text-white" size={20} />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Gestao de Gastos</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openBudgetModal}
                className="p-2 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                title="Definir orcamento"
              >
                <FiSettings size={20} />
              </button>
              <button
                onClick={openNewExpense}
                className="flex items-center gap-2 px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                <FiPlus size={18} />
                <span className="hidden sm:inline">Nova</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* Month Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiCalendar className="text-gray-400" size={18} />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="font-semibold text-gray-900 bg-transparent border-none focus:ring-0 cursor-pointer capitalize"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {getMonthName(month + '-01')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <FiFilter size={16} className="text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-sm px-2 py-1 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <FiTrendingUp size={16} />
              <span className="text-xs font-medium">Total Gasto</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(monthlyTotal)}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <FiTarget size={16} />
              <span className="text-xs font-medium">Orcamento</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {budget > 0 ? formatCurrency(budget) : '-'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <FiDollarSign size={16} />
              <span className="text-xs font-medium">Disponivel</span>
            </div>
            <p className={`text-xl font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {budget > 0 ? formatCurrency(remainingBudget) : '-'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <FiPieChart size={16} />
              <span className="text-xs font-medium">Utilizado</span>
            </div>
            <p className={`text-xl font-bold ${budgetPercentage > 90 ? 'text-red-600' : budgetPercentage > 70 ? 'text-yellow-600' : 'text-green-600'}`}>
              {budget > 0 ? `${budgetPercentage.toFixed(0)}%` : '-'}
            </p>
          </div>
        </div>

        {/* Budget Progress Bar */}
        {budget > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Progresso do orcamento</span>
              <span className={`font-medium ${budgetPercentage > 90 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCurrency(monthlyTotal)} / {formatCurrency(budget)}
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetPercentage > 90 ? 'bg-red-500' :
                  budgetPercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
              />
            </div>
            {budgetPercentage > 100 && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <FiAlertCircle size={14} />
                Orcamento ultrapassado em {formatCurrency(Math.abs(remainingBudget))}
              </p>
            )}
          </div>
        )}

        {/* Chart and Recent Expenses */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FiPieChart size={16} className="text-primary-500" />
              Gastos por Categoria
            </h3>
            {categoryTotals.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="w-48 h-48 relative">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500">Total</span>
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(monthlyTotal)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 w-full">
                  {categoryTotals.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-gray-600 truncate">{cat.name}</span>
                      <span className="text-gray-900 font-medium ml-auto">
                        {((cat.total / monthlyTotal) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FiPieChart size={40} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sem dados para mostrar</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FiTrendingUp size={16} className="text-primary-500" />
              Ultimas Despesas
            </h3>
            {recentExpenses.length > 0 ? (
              <div className="space-y-3">
                {recentExpenses.map((expense) => {
                  const category = getCategoryInfo(expense.category);
                  return (
                    <div key={expense.id} className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${category.bgColor} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>
                        {category.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{expense.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(expense.date).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm">{formatCurrency(expense.amount)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FiDollarSign size={40} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma despesa registada</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* All Expenses List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Todas as Despesas
              <span className="text-gray-400 font-normal ml-2">({expenses.length})</span>
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {paginatedExpenses.map((expense) => {
              const category = getCategoryInfo(expense.category);
              return (
                <div
                  key={expense.id}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-11 h-11 ${category.bgColor} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>
                    {category.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{expense.description}</h4>
                    <p className="text-sm text-gray-500">
                      {category.name} • {new Date(expense.date).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">{formatCurrency(expense.amount)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditExpense(expense)}
                      className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {expenses.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              <FiDollarSign size={40} className="mx-auto mb-2 opacity-50" />
              <p>Nenhuma despesa encontrada</p>
              <button
                onClick={openNewExpense}
                className="mt-4 text-primary-500 hover:text-primary-600 font-medium"
              >
                Adicionar primeira despesa
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                A mostrar {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, expenses.length)} de {expenses.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FiChevronLeft size={18} />
                </button>
                {getPageNumbers().map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-primary-500 text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FiChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-4 max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Editar Despesa' : 'Nova Despesa'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descricao *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Almoco no restaurante"
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (EUR) *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${
                        formData.category === cat.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-[10px] text-gray-600 leading-tight">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  {editingId ? 'Guardar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Definir Orcamento</h2>
              <button onClick={() => setShowBudgetModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Defina o orcamento para <span className="font-medium capitalize">{getMonthName(selectedMonth + '-01')}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (EUR)</label>
                <input
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBudgetModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBudgetSave}
                  className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
