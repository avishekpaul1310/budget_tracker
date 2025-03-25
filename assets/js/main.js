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
let expenseCategories = [];

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
    if (expenses.length < 1) return false;
    
    const categoryStats = {};
    
    // First, organize expenses by category and collect timestamps
    expenses.forEach(expense => {
        if (!categoryStats[expense.category]) {
            categoryStats[expense.category] = {
                expenses: [],
                total: 0,
                count: 0
            };
        }
        
        // Convert string date to timestamp for sorting
        const expenseDate = new Date(expense.date).getTime();
        categoryStats[expense.category].expenses.push({
            amount: expense.amount,
            date: expenseDate
        });
        categoryStats[expense.category].total += expense.amount;
        categoryStats[expense.category].count++;
    });

    Object.keys(categoryStats).forEach(category => {
        // Sort expenses by date (most recent first)
        categoryStats[category].expenses.sort((a, b) => b.date - a.date);
        
        const expensesList = categoryStats[category].expenses;
        
        // Calculate weighted average based on recency
        let weightedSum = 0;
        let weightSum = 0;
        
        expensesList.forEach((expense, index) => {
            // More recent expenses get higher weights (exponential decay)
            // Weight = 1 / (position + 1) for recency weighting
            const weight = 1 / (index + 1);
            weightedSum += expense.amount * weight;
            weightSum += weight;
        });
        
        // Calculate weighted average
        mlModel.categoryAverages[category] = weightedSum / weightSum;
        
        // Calculate variance and standard deviation with outlier handling
        const amounts = expensesList.map(e => e.amount);
        const mean = mlModel.categoryAverages[category];
        
        // Calculate quartiles for outlier detection
        amounts.sort((a, b) => a - b);
        const q1 = amounts[Math.floor(amounts.length * 0.25)];
        const q3 = amounts[Math.floor(amounts.length * 0.75)];
        const iqr = q3 - q1;
        
        // Define outlier bounds (using 1.5 * IQR method)
        const lowerBound = q1 - (1.5 * iqr);
        const upperBound = q3 + (1.5 * iqr);
        
        // Filter out outliers for standard deviation calculation
        const filteredAmounts = amounts.filter(amount => 
            amount >= lowerBound && amount <= upperBound);
        
        // If we have enough non-outlier values, use those for standard deviation
        if (filteredAmounts.length >= 3) {
            const filteredMean = filteredAmounts.reduce((a, b) => a + b) / filteredAmounts.length;
            const squareDiffs = filteredAmounts.map(amount => Math.pow(amount - filteredMean, 2));
            const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
            mlModel.monthlyPatterns[category] = Math.sqrt(avgSquareDiff);
        } else {
            // If not enough data after outlier removal, use all data but with a buffer
            const squareDiffs = amounts.map(amount => Math.pow(amount - mean, 2));
            const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
            mlModel.monthlyPatterns[category] = Math.sqrt(avgSquareDiff);
        }
        
        // Add trend detection (increasing or decreasing)
        if (expensesList.length >= 3) {
            // Compare recent expenses to earlier ones to detect trends
            const recentExpenses = expensesList.slice(0, Math.ceil(expensesList.length / 2));
            const olderExpenses = expensesList.slice(Math.ceil(expensesList.length / 2));
            
            const recentAvg = recentExpenses.reduce((sum, e) => sum + e.amount, 0) / recentExpenses.length;
            const olderAvg = olderExpenses.reduce((sum, e) => sum + e.amount, 0) / olderExpenses.length;
            
            mlModel.trends = mlModel.trends || {};
            mlModel.trends[category] = {
                direction: recentAvg > olderAvg ? 'increasing' : 
                           recentAvg < olderAvg ? 'decreasing' : 'stable',
                percentage: olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0
            };
        }
    });

    mlModel.trained = true;
    return true;
}

function predictExpense(category) {
    if (!mlModel.trained) {
        if (!trainModel()) return null;
    }

    const avg = mlModel.categoryAverages[category] || 0;
    const stdDev = mlModel.monthlyPatterns[category] || 0;
    const confidence = calculateConfidence(category);
    
    // Get trend info if available
    const trend = mlModel.trends && mlModel.trends[category] ? 
                  mlModel.trends[category] : { direction: 'stable', percentage: 0 };
    
    // Adjust expected amount based on trend
    let expectedAmount = avg;
    let trendMultiplier = 0;
    
    // Only apply trend adjustment if confidence is reasonable
    if (confidence > 30 && trend.percentage !== 0) {
        // Apply a portion of the trend to prediction
        trendMultiplier = Math.min(Math.abs(trend.percentage) / 100, 0.2); // Cap at 20% adjustment
        
        if (trend.direction === 'increasing') {
            expectedAmount *= (1 + trendMultiplier);
        } else if (trend.direction === 'decreasing') {
            expectedAmount *= (1 - trendMultiplier);
        }
    }
    
    // Calculate prediction ranges based on confidence
    // Lower confidence = wider range
    const confidenceFactor = Math.max(1, (100 - confidence) / 25); // 100% confidence = 1x stdDev, 25% confidence = 3x stdDev
    const rangeMin = Math.max(0, expectedAmount - (confidenceFactor * stdDev));
    const rangeMax = expectedAmount + (confidenceFactor * stdDev);

    return {
        expectedAmount: expectedAmount,
        confidence: parseFloat(confidence),
        suggestedMin: rangeMin,
        suggestedMax: rangeMax,
        trend: trend.direction,
        trendPercentage: Math.abs(trend.percentage).toFixed(1)
    };
}

// Calculate prediction confidence - COMPLETELY REVISED
function calculateConfidence(category) {
    const categoryExpenses = expenses.filter(e => e.category === category);
    const numExpenses = categoryExpenses.length;

    if (numExpenses < 2) return Math.min(100, numExpenses * 20); // Base confidence on number of records for very few records

    // Calculate mean (average)
    const mean = categoryExpenses.reduce((sum, e) => sum + e.amount, 0) / numExpenses;
    
    if (mean === 0) return 0; // Avoid division by zero

    // Calculate variance (spread of data)
    const variance = categoryExpenses.reduce((sum, e) => sum + Math.pow(e.amount - mean, 2), 0) / numExpenses;

    // Standard deviation (how much values deviate from the mean)
    const stdDev = Math.sqrt(variance);

    // Calculate coefficient of variation (CV) - normalized measure of dispersion
    const cv = stdDev / mean;
    
    // CV < 0.1 is very consistent data, CV > 0.3 is highly variable data
    // Convert to confidence: low CV = high confidence
    let confidenceFromVariance = Math.max(0, 100 - (cv * 200)); // CV of 0.5 or more gives 0 confidence
    
    // Blend variance-based confidence with number of records confidence
    // More records = more weight on variance-based confidence
    const recordsConfidence = Math.min(100, numExpenses * 15); // 7+ records = 100% 
    const blendFactor = Math.min(1, numExpenses / 7);
    
    // Final confidence is weighted blend of both metrics
    const finalConfidence = (confidenceFromVariance * blendFactor) + (recordsConfidence * (1 - blendFactor));
    
    return Math.min(100, finalConfidence).toFixed(1);
}

// Calculate suggested maximum amount
function calculateSuggestedMax(category) {
    if (!mlModel.categoryAverages[category]) return 0;
    return mlModel.categoryAverages[category] + (1.5 * (mlModel.monthlyPatterns[category] || 0));
}


// Check for anomalous expenses - COMPLETELY REVISED
function isAnomalousExpense(amount, category) {
    // Get previous expenses for this category
    const categoryExpenses = expenses.filter(e => e.category === category);
    
    // If no expenses for this category yet, not anomalous
    if (categoryExpenses.length === 0) return { isAnomalous: false };
    
    // If we have just one previous expense, compare directly with a higher tolerance
    if (categoryExpenses.length === 1) {
        const previousAmount = categoryExpenses[0].amount;
        const deviation = Math.abs(amount - previousAmount);
        const percentChange = deviation / previousAmount;
        
        // If more than 50% different than the previous amount, flag as anomalous
        // This is a higher threshold since we have limited data
        const isAnomalous = percentChange > 0.5;
        const isHigher = amount > previousAmount;
        
        return {
            isAnomalous,
            isHigher,
            typicalRange: {
                min: Math.max(0, previousAmount * 0.5).toFixed(2),
                avg: previousAmount.toFixed(2),
                max: (previousAmount * 1.5).toFixed(2)
            }
        };
    }
    
    // Otherwise, use statistical methods for anomaly detection
    if (!mlModel.trained) {
        if (!trainModel()) return { isAnomalous: false };
    }
    
    // Use our most recent prediction for this category
    const prediction = predictExpense(category);
    if (!prediction) return { isAnomalous: false };
    
    const expectedAmount = prediction.expectedAmount;
    const minExpected = prediction.suggestedMin;
    const maxExpected = prediction.suggestedMax;
    
    // Check if amount falls outside the expected range
    // Use a dynamic threshold based on confidence
    const confidenceFactor = Math.max(1, (100 - prediction.confidence) / 25);
    const lowerThreshold = minExpected / confidenceFactor;
    const upperThreshold = maxExpected * confidenceFactor;
    
    const isAnomalous = amount < lowerThreshold || amount > upperThreshold;
    const isHigher = amount > expectedAmount;
    
    return { 
        isAnomalous, 
        isHigher, 
        typicalRange: {
            min: Number(minExpected).toFixed(2),
            avg: Number(expectedAmount).toFixed(2),
            max: Number(maxExpected).toFixed(2)
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
                        // Always use white text for legend
                        color: '#ffffff',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 15
                    }
                },
                title: {
                    display: true,
                    text: 'Expense Distribution',
                    color: '#ffffff',
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

// Update expense summary with correct percentage calculations
function updateExpenseSummary(expensesToAnalyze = expenses) {
    const summaryDiv = document.getElementById('expenseSummary');
    
    if (expensesToAnalyze.length === 0) {
        summaryDiv.innerHTML = `
            <h3>Expense Summary</h3>
            <p>No expenses recorded yet.</p>
        `;
        return;
    }
    
    // Calculate filtered amount
    const filteredAmount = expensesToAnalyze.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Calculate total amount from ALL expenses, not just filtered
    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Get category totals for the filtered expenses
    const categoryTotals = expensesToAnalyze.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
        return acc;
    }, {});
    
    let summaryHTML = `
        <h3>Expense Summary</h3>
        <p>Number of Expenses: ${expensesToAnalyze.length} ${expensesToAnalyze.length !== expenses.length ? `(of ${expenses.length} total)` : ''}</p>
        <p>Amount: $${filteredAmount.toFixed(2)} ${expensesToAnalyze.length !== expenses.length ? `(${((filteredAmount / totalAmount) * 100).toFixed(1)}% of total)` : ''}</p>
        <h4>Category Breakdown:</h4>
        <ul>
    `;
    
    Object.entries(categoryTotals).forEach(([category, amount]) => {
        // Calculate percentage against TOTAL expenses, not just filtered
        const percentage = ((amount / totalAmount) * 100).toFixed(1);
        summaryHTML += `<li>${category}: $${amount.toFixed(2)} (${percentage}% of total budget)</li>`;
    });
    
    summaryHTML += '</ul>';
    summaryDiv.innerHTML = summaryHTML;
}

// Update ML predictions - COMPLETELY ENHANCED
function updatePredictions(category) {
    // Check if we have any expenses for this category
    const categoryExpenses = expenses.filter(e => e.category === category);
    const mlPredictionsSection = document.getElementById('mlPredictions');
    
    // Always show the predictions section to prevent layout shifting
    mlPredictionsSection.style.display = 'block';
    
    // If no expenses yet, show a starter message
    if (categoryExpenses.length === 0) {
        document.getElementById('expectedAmount').textContent = `$0.00`;
        document.getElementById('predictionConfidence').textContent = `0.0%`;
        document.getElementById('trendIndicator').innerHTML = ''; // Clear trend indicator
        
        // Make sure suggestedMin exists and update it
        const suggestedMinEl = document.getElementById('suggestedMin');
        if (suggestedMinEl) {
            suggestedMinEl.textContent = `$0.00`;
        } else {
            document.querySelector('.prediction-range').innerHTML = 
                `<p><span class="range-label">Suggested range:</span> 
                <span id="suggestedMin">$0.00</span> - <span id="suggestedMax">$0.00</span></p>`;
        }
        
        document.getElementById('suggestedMax').textContent = `$0.00`;
        
        // Update prediction message
        const messageEl = document.getElementById('predictionMessage');
        messageEl.textContent = `No data yet for "${category}". Add an expense to generate predictions.`;
        
        // Clear prediction trend
        const trendEl = document.getElementById('predictionTrend');
        trendEl.innerHTML = '';
        
        // Reset confidence bar
        const confidenceBar = document.getElementById('confidenceBar');
        confidenceBar.style.width = `0%`;
        confidenceBar.style.backgroundColor = '#e74c3c'; // Low confidence
        
        return;
    }
    
    // Get prediction data
    const prediction = predictExpense(category);
    
    if (prediction) {
        // Update main prediction values
        document.getElementById('expectedAmount').textContent = `$${Number(prediction.expectedAmount).toFixed(2)}`;
        document.getElementById('predictionConfidence').textContent = `${Number(prediction.confidence).toFixed(1)}%`;
        
        // Add trend indicator
        const trendIndicator = document.getElementById('trendIndicator');
        if (prediction.trend === 'increasing') {
            trendIndicator.innerHTML = `<span class="trend-up">▲ ${prediction.trendPercentage}%</span>`;
            trendIndicator.title = `Expenses in this category have been increasing by ${prediction.trendPercentage}%`;
        } else if (prediction.trend === 'decreasing') {
            trendIndicator.innerHTML = `<span class="trend-down">▼ ${prediction.trendPercentage}%</span>`;
            trendIndicator.title = `Expenses in this category have been decreasing by ${prediction.trendPercentage}%`;
        } else {
            trendIndicator.innerHTML = `<span class="trend-stable">◆</span>`;
            trendIndicator.title = `Expenses in this category have been stable`;
        }
        
        // Update range predictions
        const suggestedMinEl = document.getElementById('suggestedMin');
        if (suggestedMinEl) {
            suggestedMinEl.textContent = `$${Number(prediction.suggestedMin).toFixed(2)}`;
        } else {
            document.querySelector('.prediction-range').innerHTML = 
                `<p><span class="range-label">Suggested range:</span> 
                <span id="suggestedMin">$${Number(prediction.suggestedMin).toFixed(2)}</span> - 
                <span id="suggestedMax">$${Number(prediction.suggestedMax).toFixed(2)}</span></p>`;
        }
        document.getElementById('suggestedMax').textContent = `$${Number(prediction.suggestedMax).toFixed(2)}`;
        
        // Update confidence message
        const messageEl = document.getElementById('predictionMessage');
        let message = '';
        
        if (prediction.confidence < 40) {
            message = `Limited data reliability for "${category}". Predictions will improve as you add more consistent expenses.`;
        } else if (prediction.confidence < 70) {
            message = `Moderate confidence in "${category}" predictions. You typically spend around $${Number(prediction.expectedAmount).toFixed(2)}.`;
        } else {
            message = `Strong predictive patterns detected for "${category}". Expenses are consistently around $${Number(prediction.expectedAmount).toFixed(2)}.`;
        }
        messageEl.textContent = message;
        
        // Add detailed trend analysis
        const trendEl = document.getElementById('predictionTrend');
        if (categoryExpenses.length >= 3) {
            let trendHTML = '';
            
            if (prediction.trend === 'increasing') {
                trendHTML = `<p>📈 <strong>Trend analysis:</strong> ${category} expenses are <span class="trend-up">increasing</span> over time.`;
                trendHTML += ` Consider budgeting higher amounts for future expenses.</p>`;
            } else if (prediction.trend === 'decreasing') {
                trendHTML = `<p>📉 <strong>Trend analysis:</strong> ${category} expenses are <span class="trend-down">decreasing</span> over time.`;
                trendHTML += ` Your cost-saving measures appear to be working.</p>`;
            } else {
                trendHTML = `<p>📊 <strong>Trend analysis:</strong> ${category} expenses are <span class="trend-stable">stable</span> over time.`;
                trendHTML += ` This category has predictable spending patterns.</p>`;
            }
            
            trendEl.innerHTML = trendHTML;
        } else {
            trendEl.innerHTML = `<p>⚠️ Add more ${category} expenses to enable trend analysis.</p>`;
        }
        
        // Update confidence bar
        const confidenceBar = document.getElementById('confidenceBar');
        confidenceBar.style.width = `${prediction.confidence}%`;
        if (prediction.confidence < 40) {
            confidenceBar.style.backgroundColor = '#e74c3c'; // Low confidence
        } else if (prediction.confidence < 70) {
            confidenceBar.style.backgroundColor = '#f39c12'; // Medium confidence
        } else {
            confidenceBar.style.backgroundColor = '#27ae60'; // High confidence
        }
    } else {
        // If prediction fails, show error state
        document.getElementById('expectedAmount').textContent = `$0.00`;
        document.getElementById('predictionConfidence').textContent = `0.0%`;
        document.getElementById('trendIndicator').innerHTML = '';
        document.getElementById('suggestedMin').textContent = `$0.00`;
        document.getElementById('suggestedMax').textContent = `$0.00`;
        
        const messageEl = document.getElementById('predictionMessage');
        messageEl.textContent = `Error getting predictions for "${category}".`;
        
        const trendEl = document.getElementById('predictionTrend');
        trendEl.innerHTML = '';
        
        const confidenceBar = document.getElementById('confidenceBar');
        confidenceBar.style.width = `0%`;
        confidenceBar.style.backgroundColor = '#e74c3c';
    }
}

// Provide budget suggestions with ML insights - COMPLETELY REVAMPED
function provideBudgetSuggestions() {
    const totalExpenses = calculateTotalExpenses();
    const remainingBudget = totalBudget - totalExpenses;
    const suggestionsDiv = document.getElementById('budgetSuggestions');
    
    if (totalBudget === 0) {
        suggestionsDiv.innerHTML = '<div class="empty-suggestion"><p>Please set a total budget to receive AI-powered suggestions.</p></div>';
        return;
    }
    
    if (expenses.length === 0) {
        suggestionsDiv.innerHTML = '<div class="empty-suggestion"><p>Add some expenses to receive AI-powered budget insights.</p></div>';
        return;
    }
    
    // Calculate budget health metrics
    const budgetUtilizationPercent = (totalExpenses / totalBudget) * 100;
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const monthProgress = (currentDay / daysInMonth) * 100;
    
    // Get spending by category
    const categorySpending = {};
    expenses.forEach(expense => {
        categorySpending[expense.category] = (categorySpending[expense.category] || 0) + expense.amount;
    });
    
    // Identify top spending categories
    const topCategories = Object.entries(categorySpending)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, amount]) => ({ 
            category, 
            amount, 
            percentage: ((amount / totalExpenses) * 100).toFixed(1) 
        }));
    
    // Calculate burn rate (average daily spending)
    const oldestExpenseDate = new Date(Math.min(...expenses.map(e => new Date(e.date).getTime())));
    const daysSinceStart = Math.max(1, Math.ceil((new Date() - oldestExpenseDate) / (1000 * 60 * 60 * 24)));
    const burnRate = totalExpenses / daysSinceStart;
    
    // Project days until budget depleted
    const daysRemaining = burnRate > 0 ? Math.floor(remainingBudget / burnRate) : 999;
    
    // Find anomalous categories (spending significantly different from average)
    const anomalousCategories = [];
    if (mlModel.trained) {
        Object.entries(mlModel.categoryAverages).forEach(([category, avg]) => {
            const currentAmount = categorySpending[category] || 0;
            const stdDev = mlModel.monthlyPatterns[category] || 0;
            
            if (Math.abs(currentAmount - avg) > (2 * stdDev) && stdDev > 0) {
                anomalousCategories.push({
                    category,
                    isHigh: currentAmount > avg,
                    difference: Math.abs(((currentAmount - avg) / avg) * 100).toFixed(1),
                    amount: currentAmount.toFixed(2)
                });
            }
        });
    }
    
    // Generate overall budget status message
    let overallStatus = '';
    let statusClass = '';
    
    if (budgetUtilizationPercent > 100) {
        overallStatus = `<span class="status-critical">⚠️ CRITICAL: Budget exceeded by $${(totalExpenses - totalBudget).toFixed(2)}</span>`;
        statusClass = 'critical';
    } else if (budgetUtilizationPercent > monthProgress + 15) {
        overallStatus = `<span class="status-warning">⚠️ WARNING: Spending ahead of schedule (${budgetUtilizationPercent.toFixed(1)}% used vs ${monthProgress.toFixed(1)}% of time elapsed)</span>`;
        statusClass = 'warning';
    } else if (budgetUtilizationPercent < monthProgress - 20) {
        overallStatus = `<span class="status-excellent">✅ EXCELLENT: Spending well under budget (${budgetUtilizationPercent.toFixed(1)}% used vs ${monthProgress.toFixed(1)}% of time elapsed)</span>`;
        statusClass = 'excellent';
    } else {
        overallStatus = `<span class="status-good">✓ GOOD: Spending on track (${budgetUtilizationPercent.toFixed(1)}% used vs ${monthProgress.toFixed(1)}% of time elapsed)</span>`;
        statusClass = 'good';
    }
    
    // Build HTML for suggestions
    let suggestionsHTML = `
        <div class="budget-insights ${statusClass}">
            <h3>AI-Powered Budget Insights</h3>
            <div class="overall-status">${overallStatus}</div>
            
            <div class="insights-grid">
                <div class="insight-card">
                    <h4>Current Status</h4>
                    <p>Budget: $${totalBudget.toFixed(2)}</p>
                    <p>Spent: $${totalExpenses.toFixed(2)} (${budgetUtilizationPercent.toFixed(1)}%)</p>
                    <p>Remaining: $${remainingBudget.toFixed(2)}</p>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${Math.min(budgetUtilizationPercent, 100)}%; background-color: ${budgetUtilizationPercent > 90 ? '#e74c3c' : budgetUtilizationPercent > 75 ? '#f39c12' : '#27ae60'}"></div>
                    </div>
                </div>
                
                <div class="insight-card">
                    <h4>Spending Forecast</h4>
                    <p>Daily burn rate: $${burnRate.toFixed(2)}</p>
                    <p>At this rate: <strong>${daysRemaining < 999 ? `${daysRemaining} days remaining` : 'Budget will last indefinitely'}</strong></p>
                    <p>${budgetUtilizationPercent > monthProgress ? 'Spending faster than time elapsed' : 'Spending slower than time elapsed'}</p>
                </div>
                
                <div class="insight-card">
                    <h4>Top Spending Areas</h4>
                    ${topCategories.map(cat => `<p>${cat.category}: $${cat.amount.toFixed(2)} (${cat.percentage}%)</p>`).join('')}
                </div>
    `;
    
    // Add anomaly insights if any exist
    if (anomalousCategories.length > 0) {
        suggestionsHTML += `
            <div class="insight-card anomaly">
                <h4>Unusual Spending Patterns</h4>
                ${anomalousCategories.map(anomaly => 
                    `<p>${anomaly.isHigh ? '🔺' : '🔻'} ${anomaly.category}: ${anomaly.isHigh ? 'Up' : 'Down'} by ${anomaly.difference}% ($${anomaly.amount})</p>`
                ).join('')}
            </div>
        `;
    }
    
    // Closing the insights grid
    suggestionsHTML += `</div>`;
    
    // Add actionable recommendations based on budget status
    suggestionsHTML += `<h4>Smart Recommendations</h4><ul class="recommendations">`;
    
    // Generate tailored recommendations
    if (budgetUtilizationPercent > 100) {
        // Over budget recommendations
        suggestionsHTML += `
            <li>🚨 <strong>Immediate action needed:</strong> Review and cut non-essential expenses.</li>
            <li>💰 Consider reallocating funds from lower-priority categories.</li>
            <li>📊 Analyze if this is a one-time overspending or a recurring pattern.</li>
        `;
        
        // Add category-specific recommendations for over budget
        if (topCategories.length > 0) {
            suggestionsHTML += `<li>📉 Focus on reducing expenses in your highest spending category: ${topCategories[0].category} (${topCategories[0].percentage}% of total).</li>`;
        }
        
    } else if (budgetUtilizationPercent > monthProgress + 15) {
        // Heading toward over budget
        suggestionsHTML += `
            <li>⚠️ <strong>Caution needed:</strong> Your spending rate may lead to budget overrun.</li>
            <li>🔍 Identify non-essential expenses that can be deferred.</li>
            <li>⏱️ At your current burn rate of $${burnRate.toFixed(2)}/day, consider adjusting to extend your budget.</li>
        `;
        
        // Add category-specific recommendations
        if (anomalousCategories.filter(a => a.isHigh).length > 0) {
            const highAnomalies = anomalousCategories.filter(a => a.isHigh);
            suggestionsHTML += `<li>💲 Look into why ${highAnomalies[0].category} is ${highAnomalies[0].difference}% higher than usual.</li>`;
        }
        
    } else if (budgetUtilizationPercent < monthProgress - 20) {
        // Under budget
        suggestionsHTML += `
            <li>✅ <strong>Great job:</strong> You're well under budget!</li>
            <li>💼 Consider if some under-utilized budget areas need attention.</li>
            <li>💰 You could potentially reallocate $${(totalBudget * 0.1).toFixed(2)} to higher-priority needs.</li>
        `;
        
        // Add category-specific recommendations for under budget
        if (anomalousCategories.filter(a => !a.isHigh).length > 0) {
            const lowAnomalies = anomalousCategories.filter(a => !a.isHigh);
            suggestionsHTML += `<li>📈 ${lowAnomalies[0].category} spending is unusually low. Consider if this area needs more investment.</li>`;
        }
        
    } else {
        // On track
        suggestionsHTML += `
            <li>✅ <strong>Well done:</strong> Your spending is on track with your budget timeline.</li>
            <li>📆 Continue monitoring expenses to maintain this balance.</li>
            <li>💡 Review upcoming expenses to ensure you stay on this positive trajectory.</li>
        `;
    }
    
    // Add general recommendations based on data insights
    if (topCategories.length > 1 && (topCategories[0].percentage > 40)) {
        suggestionsHTML += `<li>⚖️ Your budget is heavily weighted toward ${topCategories[0].category} (${topCategories[0].percentage}%). Consider if this allocation is optimal.</li>`;
    }
    
    if (expenses.length > 10 && daysRemaining < 30 && remainingBudget > 0) {
        suggestionsHTML += `<li>📅 Budget projection: At current rates, funds will be depleted in ${daysRemaining} days.</li>`;
    }
    
    // Close the recommendations list and HTML
    suggestionsHTML += `</ul>`;
    
    // Set the HTML content
    suggestionsDiv.innerHTML = suggestionsHTML;
}

// Event listeners section - Complete
document.addEventListener('DOMContentLoaded', () => {
    // Initialize displays and charts
    updateBudgetDisplay();
    updateCharts();
    provideBudgetSuggestions();
    updateCategoryDropdowns();
    updateExpenseSummary();

    // Show a welcome message suggesting to add categories if none exist
    if (expenseCategories.length === 0) {
        const expenseCategorySelect = document.getElementById('expenseCategory');
        if (expenseCategorySelect) {
            // Add a disabled placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.textContent = 'Please add categories first';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            expenseCategorySelect.appendChild(placeholderOption);
            
            // Show a notification or highlight the category management section
            const categoryManagement = document.querySelector('.category-management');
            if (categoryManagement) {
                categoryManagement.classList.add('highlight-section');
                
                // You can also show a notification
                const notification = document.createElement('div');
                notification.className = 'notification';
                notification.textContent = 'Please add categories before adding expenses';
                notification.style.color = '#e74c3c';
                notification.style.marginBottom = '10px';
                notification.style.fontWeight = 'bold';
                
                // Insert before the expense input section
                const expenseInputSection = document.querySelector('.expense-input-section');
                if (expenseInputSection && expenseInputSection.parentNode) {
                    expenseInputSection.parentNode.insertBefore(notification, expenseInputSection);
                    
                    // Auto-remove after 5 seconds
                    setTimeout(() => {
                        notification.style.opacity = '0';
                        setTimeout(() => notification.remove(), 500);
                    }, 5000);
                }
            }
        }
    }
    
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

    document.getElementById('expenseCategory').addEventListener('change', function() {
        updatePredictions(this.value);
    });

    // Update anomaly detection when amount changes
    document.getElementById('expenseAmount').addEventListener('input', function() {
        const amount = parseFloat(this.value);
        const category = document.getElementById('expenseCategory').value;
        
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
    
    // Expense input events
    const expenseCategory = document.getElementById('expenseCategory');
    const expenseAmount = document.getElementById('expenseAmount');
    const expenseDesc = document.getElementById('expenseDescription');
    
    // Update predictions when category changes
    expenseCategory.addEventListener('change', function() {
        updatePredictions(this.value);
        
        // Also update anomaly check if amount is already entered
        const amountInput = document.getElementById('expenseAmount');
        if (amountInput && amountInput.value) {
            const amount = parseFloat(amountInput.value);
            const category = this.value;
            
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
        }
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
    // Check if we have categories first
    if (expenseCategories.length === 0) {
        alert('Please add some categories first before adding sample data.');
        return;
    }
    
    // Use the available categories for sample expenses
    const sampleExpenses = [];
    
    // Generate sample expenses using available categories
    for (let i = 0; i < Math.min(5, expenseCategories.length * 2); i++) {
        // Pick a random category from available ones
        const randomCategory = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
        
        sampleExpenses.push({
            category: randomCategory,
            amount: Math.floor(Math.random() * 900) + 100, // Random amount between 100 and 1000
            description: `Sample ${randomCategory} expense ${i+1}`
        });
    }
    
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
    });
    
    trainModel();
    updateBudgetDisplay();
    updateExpenseList();
    updateCharts();
    provideBudgetSuggestions();
    updateExpenseSummary();
    
    alert('Sample data added successfully!');
}

// Helper function to format currency consistently
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}
