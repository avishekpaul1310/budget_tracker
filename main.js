// Global variables
let totalBudget = 0;
let expenses = [];
let pieChart = null;
let mlModel = {
    categoryAverages: {},
    monthlyPatterns: {},
    trained: false
};

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
function updateExpenseList() {
    const expenseList = document.getElementById('expenseList');
    expenseList.innerHTML = '';

    expenses.forEach((expense, index) => {
        const expenseElement = document.createElement('div');
        expenseElement.className = 'expense-item';
        expenseElement.innerHTML = `
            <span>${expense.date} - ${expense.category}: ${expense.description}</span>
            <span>$${expense.amount.toFixed(2)}</span>
        `;
        expenseList.appendChild(expenseElement);
    });
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

// Add event listener for category selection
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

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    updateBudgetDisplay();
    updateCharts();
    provideBudgetSuggestions();
});
