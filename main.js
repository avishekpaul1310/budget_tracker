// Global variables
let totalBudget = 0;
let expenses = [];
let pieChart = null;
let mlModel = {
    categoryAverages: {},
    monthlyPatterns: {},
    trained: false
};
// Add new global variable for categories
let expenseCategories = [
    "equipment",
    "salaries",
    "marketing",
    "miscellaneous"
];

// Set the total budget
function setTotalBudget() {
    const budgetInput = document.getElementById('totalBudget');
    const amount = parseFloat(budgetInput.value);
    
    if (amount > 0) {
        totalBudget = amount;
        updateBudgetDisplay();
        updateCharts();
        provideBudgetSuggestions();
        budgetInput.value = '';
    } else {
        alert('Please enter a valid budget amount');
    }
}

// Add new category
function addNewCategory() {
    const newCategory = document.getElementById('newCategory').value.trim().toLowerCase();
    if (newCategory && !expenseCategories.includes(newCategory)) {
        expenseCategories.push(newCategory);
        updateCategoryDropdowns();
        document.getElementById('newCategory').value = '';
    } else {
        alert('Please enter a valid unique category name');
    }
}

// Update category dropdowns
function updateCategoryDropdowns() {
    const categorySelect = document.getElementById('expenseCategory');
    const filterCategory = document.getElementById('filterCategory');
    
    // Store current selection
    const currentCategory = categorySelect.value;
    const currentFilter = filterCategory.value;
    
    // Clear existing options
    categorySelect.innerHTML = '';
    filterCategory.innerHTML = '<option value="all">All Categories</option>';
    
    // Add categories to both dropdowns
    expenseCategories.forEach(category => {
        categorySelect.add(new Option(category, category));
        filterCategory.add(new Option(category, category));
    });
    
    // Restore selection if it still exists
    if (expenseCategories.includes(currentCategory)) {
        categorySelect.value = currentCategory;
    }
    
    if (currentFilter === 'all' || expenseCategories.includes(currentFilter)) {
        filterCategory.value = currentFilter;
    }
}

// Train the statistical model
function trainModel() {
    if (expenses.length < 2) return false;
    
    const categoryStats = {};
    expenses.forEach(expense => {
        if (!categoryStats[expense.category]) {
            categoryStats[expense.category] = {
                amounts: [],
                total: 0,
                count: 0
            };
        }
        categoryStats[expense.category].amounts.push(expense.amount);
        categoryStats[expense.category].total += expense.amount;
        categoryStats[expense.category].count++;
    });

    Object.keys(categoryStats).forEach(category => {
        mlModel.categoryAverages[category] = categoryStats[category].total / categoryStats[category].count;
        
        const mean = mlModel.categoryAverages[category];
        const squareDiffs = categoryStats[category].amounts.map(amount => Math.pow(amount - mean, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
        mlModel.monthlyPatterns[category] = Math.sqrt(avgSquareDiff);
    });

    mlModel.trained = true;
    return true;
}

// Predict expense for a category
function predictExpense(category) {
    if (!mlModel.trained) {
        if (!trainModel()) return null;
    }

    const prediction = {
        expectedAmount: mlModel.categoryAverages[category] || 0,
        confidence: calculateConfidence(category),
        suggestedMax: calculateSuggestedMax(category)
    };

    return prediction;
}

// Calculate prediction confidence
function calculateConfidence(category) {
    const categoryExpenses = expenses.filter(e => e.category === category);
    // More data = more confidence, max at 100%
    return Math.min(100, (categoryExpenses.length / 3) * 100);
}

// Calculate suggested maximum amount
function calculateSuggestedMax(category) {
    if (!mlModel.categoryAverages[category]) return 0;
    return mlModel.categoryAverages[category] + (1.5 * (mlModel.monthlyPatterns[category] || 0));
}

// Check for anomalous expenses - IMPROVED to detect higher or lower
function isAnomalousExpense(amount, category) {
    if (!mlModel.trained) return { isAnomalous: false };
    
    const avg = mlModel.categoryAverages[category];
    const stdDev = mlModel.monthlyPatterns[category];
    
    if (!avg || !stdDev) return { isAnomalous: false };
    
    const deviation = Math.abs(amount - avg);
    const isAnomalous = deviation > (1.5 * stdDev);
    const isHigher = amount > avg;
    
    return { 
        isAnomalous, 
        isHigher, 
        typicalRange: {
            min: Math.max(0, avg - stdDev).toFixed(2),
            avg: avg.toFixed(2),
            max: (avg + stdDev).toFixed(2)
        }
    };
}

// Add expense with ML integration
function addExpense() {
    const category = document.getElementById('expenseCategory').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDescription').value;

    if (amount > 0 && description) {
        // Check for anomalous expense
        const anomalyCheck = isAnomalousExpense(amount, category);
        if (anomalyCheck.isAnomalous) {
            let message = anomalyCheck.isHigher ? 
                `This expense appears unusually HIGH for this category. The typical range is around $${anomalyCheck.typicalRange.avg} (±$${anomalyCheck.typicalRange.min}-$${anomalyCheck.typicalRange.max}).` : 
                `This expense appears unusually LOW for this category. The typical range is around $${anomalyCheck.typicalRange.avg} (±$${anomalyCheck.typicalRange.min}-$${anomalyCheck.typicalRange.max}).`;
            
            const proceed = confirm(message + " Do you want to proceed?");
            if (!proceed) return;
        }

        const expense = {
            id: Date.now(), // Add unique ID for deletion
            category,
            amount,
            description,
            date: new Date().toLocaleDateString(),
            isAnomalous: anomalyCheck?.isAnomalous || false
        };

        expenses.push(expense);
        trainModel(); // Retrain model with new data
        updateBudgetDisplay();
        updateExpenseList();
        updateCharts();
        provideBudgetSuggestions();
        updateExpenseSummary();

        // Clear input fields
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDescription').value = '';
    } else {
        alert('Please enter valid expense details');
    }
}

function clearFields() {
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseWarning').style.display = 'none';
    document.getElementById('mlPredictions').style.display = 'none';
    
    // Clear local storage for these fields
    localStorage.removeItem('expenseAmount');
    localStorage.removeItem('expenseDescription');
}

// NEW: Delete expense function
function deleteExpense(id) {
    if (confirm("Are you sure you want to delete this expense?")) {
        expenses = expenses.filter(expense => expense.id !== id);
        trainModel(); // Retrain model with new data
        updateBudgetDisplay();
        updateExpenseList();
        updateCharts();
        provideBudgetSuggestions();
        updateExpenseSummary();
    }
}

// Add function to export data
function exportExpenseData() {
    const data = {
        totalBudget,
        expenses,
        categories: expenseCategories,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget-tracker-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Filter and sort expenses function
function filterAndSortExpenses() {
    const filterCategory = document.getElementById('filterCategory').value;
    const sortBy = document.getElementById('sortBy').value;
    let filteredExpenses = [...expenses];
    
    // Apply category filter
    if (filterCategory !== 'all') {
        filteredExpenses = filteredExpenses.filter(e => e.category === filterCategory);
    }
    
    // Apply sorting
    switch(sortBy) {
        case 'date-desc':
            filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'date-asc':
            filteredExpenses.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'amount-desc':
            filteredExpenses.sort((a, b) => b.amount - a.amount);
            break;
        case 'amount-asc':
            filteredExpenses.sort((a, b) => a.amount - b.amount);
            break;
    }
    
    updateExpenseList(filteredExpenses);
    updateExpenseSummary(filteredExpenses);
}

// Update budget display
function updateBudgetDisplay() {
    const totalExpenses = calculateTotalExpenses();
    const remainingBudget = totalBudget - totalExpenses;
    const budgetUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

    document.getElementById('displayTotalBudget').textContent = `$${totalBudget.toFixed(2)}`;
    document.getElementById('displayTotalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
    document.getElementById('displayRemainingBudget').textContent = `$${remainingBudget.toFixed(2)}`;
    
    const progressBar = document.getElementById('budgetProgress');
    progressBar.style.width = `${Math.min(budgetUtilization, 100)}%`;
    progressBar.style.backgroundColor = budgetUtilization > 90 ? '#e74c3c' : '#27ae60';
}

// Calculate total expenses
function calculateTotalExpenses() {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
}

// Update expense list with better formatting and delete option
function updateExpenseList(expensesToShow = expenses) {
    const expenseList = document.getElementById('expenseList');
    expenseList.innerHTML = '';

    if (expensesToShow.length === 0) {
        expenseList.innerHTML = '<div class="no-expenses">No expenses to display</div>';
        return;
    }

    expensesToShow.forEach((expense, index) => {
        const expenseElement = document.createElement('div');
        expenseElement.className = `expense-item ${index % 2 === 0 ? 'even' : 'odd'} ${expense.isAnomalous ? 'anomalous' : ''}`;
        expenseElement.innerHTML = `
            <div class="expense-details">
                <div class="expense-date-cat">${expense.date} - <span class="category-tag">${expense.category}</span></div>
                <div class="expense-desc">${expense.description}</div>
            </div>
            <div class="expense-amount-actions">
                <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
                <button class="delete-expense" onclick="deleteExpense(${expense.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        expenseList.appendChild(expenseElement);
    });
}

// Update charts with better visibility and contrast
function updateCharts() {
    const ctx = document.getElementById('expensePieChart');
    
    if (pieChart) {
        pieChart.destroy();
    }

    const categoryTotals = {};
    expenses.forEach(expense => {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    // Improved high-contrast colors
    const chartColors = [
        '#2980b9', // Strong Blue
        '#27ae60', // Strong Green
        '#c0392b', // Strong Red
        '#f39c12', // Strong Orange
        '#8e44ad', // Strong Purple
        '#16a085', // Strong Teal
        '#d35400', // Strong Pumpkin
        '#2c3e50', // Strong Navy
        '#e74c3c', // Strong Crimson
        '#1abc9c'  // Strong Turquoise
    ];

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: chartColors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20,
                        color: function(context) {
                            // Return the color of the category
                            return chartColors[context.dataIndex];
                        }
                    },
                    onClick: function(e, legendItem, legend) {
                        // Keep default behavior
                        Chart.defaults.plugins.legend.onClick.call(this, e, legendItem, legend);
                    }
                },
                title: {
                    display: true,
                    text: 'Expense Distribution',
                    font: {
                        size: 20,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                tooltip: {
                    titleFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 14
                    },
                    callbacks: {
                        label: function(context) {
                            const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
                            const value = context.raw;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: $${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Update expense summary - FIXED
function updateExpenseSummary(expensesToAnalyze = expenses) {
    const summaryDiv = document.getElementById('expenseSummary');
    
    if (expensesToAnalyze.length === 0) {
        summaryDiv.innerHTML = `
            <h3>Expense Summary</h3>
            <p>No expenses recorded yet.</p>
        `;
        return;
    }
    
    const totalAmount = expensesToAnalyze.reduce((sum, exp) => sum + exp.amount, 0);
    const categoryTotals = expensesToAnalyze.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
        return acc;
    }, {});
    
    let summaryHTML = `
        <h3>Expense Summary</h3>
        <p>Number of Expenses: ${expensesToAnalyze.length}</p>
        <p>Total Amount: $${totalAmount.toFixed(2)}</p>
        <h4>Category Breakdown:</h4>
        <ul>
    `;
    
    Object.entries(categoryTotals).forEach(([category, amount]) => {
        const percentage = ((amount / totalAmount) * 100).toFixed(1);
        summaryHTML += `<li>${category}: $${amount.toFixed(2)} (${percentage}%)</li>`;
    });
    
    summaryHTML += '</ul>';
    summaryDiv.innerHTML = summaryHTML;
}

// Provide budget suggestions with ML insights

function provideBudgetSuggestions() {
    const totalExpenses = calculateTotalExpenses();
    const remainingBudget = totalBudget - totalExpenses;
    const suggestionsDiv = document.getElementById('budgetSuggestions');
    
    let mlInsights = '';
    if (mlModel.trained) {
        mlInsights = `
            <p><strong>AI-Powered Insights:</strong></p>
            <ul>
                ${Object.entries(mlModel.categoryAverages).map(([category, avg]) => 
                    `<li>${category}: Average expense $${avg.toFixed(2)} 
                     (±$${(mlModel.monthlyPatterns[category] || 0).toFixed(2)})</li>`
                ).join('')}
            </ul>
        `;
    }

    if (totalBudget === 0) {
        suggestionsDiv.innerHTML = '<p>Please set a total budget to receive suggestions.</p>';
        return;
    }

    let suggestionContent = '';
    if (totalExpenses > totalBudget) {
        suggestionContent = `
            <p>⚠️ Warning: You have exceeded your budget by $${(totalExpenses - totalBudget).toFixed(2)}</p>
            <p>Suggestions:</p>
            <ul>
                <li>Review and cut non-essential expenses</li>
                <li>Consider reallocating funds from lower-priority categories</li>
                <li>Look for cost-effective alternatives for expensive items</li>
            </ul>
        `;
    } else if ((totalExpenses / totalBudget) > 0.8) {
        suggestionContent = `
            <p>⚠️ Note: You have used ${((totalExpenses / totalBudget) * 100).toFixed(1)}% of your budget</p>
            <p>Suggestions:</p>
            <ul>
                <li>Carefully monitor remaining expenses</li>
                <li>Prioritize essential expenses</li>
                <li>Consider saving some budget for unexpected costs</li>
            </ul>
        `;
    } else {
        suggestionContent = `
            <p>✅ Your budget utilization is healthy at ${((totalExpenses / totalBudget) * 100).toFixed(1)}%</p>
            <p>Remaining budget: $${remainingBudget.toFixed(2)}</p>
        `;
    }

    suggestionsDiv.innerHTML = suggestionContent + mlInsights;
}

// Event listeners section - Complete
document.addEventListener('DOMContentLoaded', () => {
    // Initialize displays and charts
    updateBudgetDisplay();
    updateCharts();
    provideBudgetSuggestions();
    updateCategoryDropdowns();
    updateExpenseSummary();
    
    // Budget input events
    document.getElementById('totalBudget').addEventListener('input', function() {
        // Validate to only allow numbers and decimal point
        this.value = this.value.replace(/[^0-9.]/g, '');
    });
    
    document.getElementById('totalBudget').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            setTotalBudget();
        }
    });
    
    // Category management events
    document.getElementById('newCategory').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addNewCategory();
        }
    });
    
    // Expense input events
    const expenseCategory = document.getElementById('expenseCategory');
    const expenseAmount = document.getElementById('expenseAmount');
    const expenseDesc = document.getElementById('expenseDescription');
    
    // Update predictions when category changes
    expenseCategory.addEventListener('change', function() {
        updatePredictions(this.value);
    });
    
    // Validate expense amount input
    expenseAmount.addEventListener('input', function() {
        // Validate to only allow numbers and decimal point
        this.value = this.value.replace(/[^0-9.]/g, '');
    });
    
    // Update anomaly detection when amount changes
    expenseAmount.addEventListener('input', function() {
        const amount = parseFloat(this.value);
        const category = expenseCategory.value;
        
        if (amount && category) {
            const anomalyCheck = isAnomalousExpense(amount, category);
            const warningEl = document.getElementById('expenseWarning');
            
            if (anomalyCheck.isAnomalous) {
                let message = anomalyCheck.isHigher ? 
                    `This amount appears unusually HIGH for ${category}. Typical: $${anomalyCheck.typicalRange.avg}.` : 
                    `This amount appears unusually LOW for ${category}. Typical: $${anomalyCheck.typicalRange.avg}.`;
                
                warningEl.textContent = message;
                warningEl.style.display = 'block';
            } else {
                warningEl.style.display = 'none';
            }
        }
    });
    
    // Enter key support for expense description
    expenseDesc.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addExpense();
        }
    });
    
    // Clear fields button
    document.getElementById('clearFields').addEventListener('click', function() {
        clearFields();
    });
    
    // Filter and sort events
    const filterCategoryElement = document.getElementById('filterCategory');
    const sortByElement = document.getElementById('sortBy');
    
    if (filterCategoryElement) {
        filterCategoryElement.addEventListener('change', filterAndSortExpenses);
    }
    
    if (sortByElement) {
        sortByElement.addEventListener('change', filterAndSortExpenses);
    }
    
    // Export button effects
    const exportButton = document.querySelector('.export-button');
    if (exportButton) {
        exportButton.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
        });
        
        exportButton.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    }
    
    // Auto-save form data to localStorage
    ['expenseAmount', 'expenseDescription', 'expenseCategory'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', function() {
                localStorage.setItem(id, this.value);
            });
        }
    });
    
    // Restore saved form data if exists
    const restoreFormData = () => {
        ['expenseAmount', 'expenseDescription', 'expenseCategory'].forEach(id => {
            const savedValue = localStorage.getItem(id);
            const element = document.getElementById(id);
            if (savedValue && element) {
                element.value = savedValue;
            }
        });
    };
    restoreFormData();
    
    // Initial predictions update if category is pre-selected
    if (expenseCategory && expenseCategory.value) {
        updatePredictions(expenseCategory.value);
    }
    
    // Window resize event for chart responsiveness
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            updateCharts();
        }, 250);
    });
    
    // Theme toggle (if you have a theme toggle button)
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            const isDarkMode = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDarkMode);
            
            // Update charts for better visibility in current theme
            updateCharts();
        });
        
        // Check for saved theme preference
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
        }
    }
    
    // Add sample data button (if you have one)
    const sampleDataButton = document.getElementById('addSampleData');
    if (sampleDataButton) {
        sampleDataButton.addEventListener('click', addSampleData);
    }
});

// Helper function to add sample data for testing (optional)
function addSampleData() {
    const sampleExpenses = [
        { category: 'equipment', amount: 250, description: 'Office computer' },
        { category: 'salaries', amount: 1200, description: 'Contract work' },
        { category: 'marketing', amount: 350, description: 'Social media ads' },
        { category: 'equipment', amount: 120, description: 'Printer' },
        { category: 'miscellaneous', amount: 75, description: 'Office supplies' }
    ];
    
    if (totalBudget === 0) {
        setTotalBudget(3000); // Set a default budget
    }
    
    sampleExpenses.forEach(exp => {
        const expense = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            category: exp.category,
            amount: exp.amount,
            description: exp.description,
            date: new Date().toLocaleDateString(),
            isAnomalous: false
        };
        expenses.push(expense);
        
        // Wait a bit between adding expenses
        setTimeout(() => {}, 50);
    });
    
    trainModel();
    updateBudgetDisplay();
    updateExpenseList();
    updateCharts();
    provideBudgetSuggestions();
    updateExpenseSummary();
    
    alert('Sample data added successfully!');
}
