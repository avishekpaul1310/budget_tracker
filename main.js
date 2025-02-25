// Global variables
let totalBudget = 0;
let expenses = [];
let pieChart = null;
let mlModel = {
    categoryAverages: {},
    monthlyPatterns: {},
    trained: false
};
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

// Train the statistical model
function trainModel() {
    if (expenses.length < 5) return false;
    
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

// Add new function to manage categories
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
    
    // Clear existing options
    categorySelect.innerHTML = '';
    filterCategory.innerHTML = '<option value="all">All Categories</option>';
    
    // Add categories to both dropdowns
    expenseCategories.forEach(category => {
        categorySelect.add(new Option(category, category));
        filterCategory.add(new Option(category, category));
    });
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
    return Math.min(100, (categoryExpenses.length / 5) * 100);
}

// Calculate suggested maximum amount
function calculateSuggestedMax(category) {
    if (!mlModel.categoryAverages[category]) return 0;
    return mlModel.categoryAverages[category] + (2 * (mlModel.monthlyPatterns[category] || 0));
}

// Check for anomalous expenses
function isAnomalousExpense(amount, category) {
    if (!mlModel.trained) return false;
    
    const avg = mlModel.categoryAverages[category];
    const stdDev = mlModel.monthlyPatterns[category];
    
    return Math.abs(amount - avg) > (2 * stdDev);
}

// Add expense with ML integration
function addExpense() {
    const category = document.getElementById('expenseCategory').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDescription').value;

    if (amount > 0 && description) {
        // Check for anomalous expense
        if (isAnomalousExpense(amount, category)) {
            const proceed = confirm(`This expense appears unusual for this category. The typical range is around $${mlModel.categoryAverages[category].toFixed(2)}. Do you want to proceed?`);
            if (!proceed) return;
        }

        const expense = {
            category,
            amount,
            description,
            date: new Date().toLocaleDateString()
        };

        expenses.push(expense);
        trainModel(); // Retrain model with new data
        updateBudgetDisplay();
        updateExpenseList();
        updateCharts();
        provideBudgetSuggestions();

        // Clear input fields
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDescription').value = '';
    } else {
        alert('Please enter valid expense details');
    }
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
    progressBar.style.backgroundColor = budgetUtilization > 90 ? '#e74c3c' : '#2ecc71';
}

// Calculate total expenses
function calculateTotalExpenses() {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
}

// Update charts
function updateCharts() {
    const ctx = document.getElementById('expensePieChart');
    
    if (pieChart) {
        pieChart.destroy();
    }

    const categoryTotals = {};
    expenses.forEach(expense => {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: [
                    '#2ecc71',
                    '#3498db',
                    '#e74c3c',
                    '#f1c40f'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Expense Distribution'
                }
            }
        }
    });
}

// Update expense list
function updateExpenseList(expensesToShow = expenses) {
    const expenseList = document.getElementById('expenseList');
    expenseList.innerHTML = '';

    expensesToShow.forEach((expense) => {
        const expenseElement = document.createElement('div');
        expenseElement.className = 'expense-item';
        expenseElement.innerHTML = `
            <span>${expense.date} - ${expense.category}: ${expense.description}</span>
            <span>$${expense.amount.toFixed(2)}</span>
        `;
        expenseList.appendChild(expenseElement);
    });
}

function updateExpenseSummary(expensesToAnalyze = expenses) {
    const summaryDiv = document.getElementById('expenseSummary');
    
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

// Add function to filter and sort expenses
function filterAndSortExpenses() {
    const filterCategory = document.getElementById('filterCategory').value;
    const sortBy = document.getElementById('sortBy').value;
    const filteredExpenses = [...expenses];
    
    // Apply category filter
    if (filterCategory !== 'all') {
        filteredExpenses.splice(0, filteredExpenses.length, 
            ...filteredExpenses.filter(e => e.category === filterCategory)
        );
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

// Add event listener for category selection
document.addEventListener('DOMContentLoaded', () => {
    // Initialize displays and charts
    updateBudgetDisplay();
    updateCharts();
    provideBudgetSuggestions();
    updateCategoryDropdowns();
    updateExpenseSummary();
    
    // Category selection event listener
    document.getElementById('expenseCategory').addEventListener('change', function() {
        const selectedCategory = this.value;
        const prediction = predictExpense(selectedCategory);
        
        if (prediction) {
            document.getElementById('mlPredictions').style.display = 'block';
            document.getElementById('expectedAmount').textContent = `$${prediction.expectedAmount.toFixed(2)}`;
            document.getElementById('predictionConfidence').textContent = `${prediction.confidence.toFixed(1)}%`;
            document.getElementById('suggestedMax').textContent = `$${prediction.suggestedMax.toFixed(2)}`;
        } else {
            document.getElementById('mlPredictions').style.display = 'none';
        }
    });

    // Filter and sort event listeners
    document.getElementById('filterCategory').addEventListener('change', filterAndSortExpenses);
    document.getElementById('sortBy').addEventListener('change', filterAndSortExpenses);

    // Input validation for budget and expense amounts
    document.getElementById('totalBudget').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9.]/g, '');
    });

    document.getElementById('expenseAmount').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9.]/g, '');
    });

    // Enter key support for inputs
    document.getElementById('totalBudget').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            setTotalBudget();
        }
    });

    document.getElementById('expenseDescription').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addExpense();
        }
    });

    document.getElementById('newCategory').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addNewCategory();
        }
    });

    // Real-time expense amount validation
    document.getElementById('expenseAmount').addEventListener('change', function() {
        const amount = parseFloat(this.value);
        const category = document.getElementById('expenseCategory').value;
        
        if (amount && isAnomalousExpense(amount, category)) {
            document.getElementById('expenseWarning').textContent = 
                `Warning: This amount is unusually high for ${category} category`;
            document.getElementById('expenseWarning').style.display = 'block';
        } else {
            document.getElementById('expenseWarning').style.display = 'none';
        }
    });

    // Window resize event for chart responsiveness
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            updateCharts();
        }, 250);
    });

    // Export button hover effect
    document.querySelector('.export-button').addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.05)';
    });

    document.querySelector('.export-button').addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });

    // Clear form fields button
    document.getElementById('clearFields').addEventListener('click', function() {
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDescription').value = '';
        document.getElementById('expenseWarning').style.display = 'none';
        document.getElementById('mlPredictions').style.display = 'none';
    });

    // Auto-save to localStorage
    ['expenseAmount', 'expenseDescription', 'expenseCategory'].forEach(id => {
        document.getElementById(id).addEventListener('change', function() {
            localStorage.setItem(id, this.value);
        });
    });

    // Restore saved form data if exists
    const restoreFormData = () => {
        ['expenseAmount', 'expenseDescription', 'expenseCategory'].forEach(id => {
            const savedValue = localStorage.getItem(id);
            if (savedValue) {
                document.getElementById(id).value = savedValue;
            }
        });
    };
    restoreFormData();
});
