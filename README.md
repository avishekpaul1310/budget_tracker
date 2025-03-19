# Budget Tracker

![Budget Tracker](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A smart, interactive budget tracking application with machine learning capabilities to help you manage expenses and make informed financial decisions.

## 📋 Table of Contents

- [Features](#-features)
- [Demo](#-demo)
- [Technologies Used](#-technologies-used)
- [Installation](#-installation)
- [Usage](#-usage)
- [ML Features](#-ml-features)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

- **Set and Track Budget:** Set a total budget and track expenses against it
- **Categorized Expenses:** Organize expenses by custom categories
- **Real-time Analytics:** Visual representation of expense distribution with interactive charts
- **Anomalous Expense Detection:** AI-powered detection of unusual spending patterns
- **Smart Budget Suggestions:** Get personalized recommendations based on spending habits
- **Expense Predictions:** ML model predicts expected expense amounts for categories
- **Filtering and Sorting:** Easily filter and sort expenses by various criteria
- **Data Export:** Export your budget data for backup or analysis
- **Responsive Design:** Works perfectly on both desktop and mobile devices
- **Dark Mode Support:** Automatic dark mode detection for comfortable viewing

## 🎮 Demo

To use the application:

1. Set your total budget
2. Add expense categories (groceries, rent, entertainment, etc.)
3. Add expenses with amounts and descriptions
4. View automatically generated charts, predictions, and budget insights

## 🛠️ Technologies Used

- **HTML5** - Structure
- **CSS3** - Styling and responsive design
- **JavaScript** - Core functionality and machine learning models
- **Chart.js** - Data visualization
- **Local Storage** - Data persistence

## 📥 Installation

1. Clone the repository:
```
git clone https://github.com/avishekpaul1310/budget_tracker.git
```

2. Open the project folder:
```
cd budget_tracker
```

3. Open `template.html` in your browser

No additional dependencies or build steps required - this project runs entirely in the browser!

## 💻 Usage

### Set Budget

Enter your total budget in the "Set Project Budget" section to get started.

### Manage Categories

Add custom categories for your expenses like "Rent", "Groceries", "Entertainment", etc.

### Add Expenses

Select a category, enter an amount and description, then add your expense. The application will:
- Check if the expense is anomalous based on your spending patterns
- Update budget visualization automatically
- Recalculate predictions for future expenses

### View Insights

The application provides:
- Visual breakdown of your spending
- Smart budget recommendations
- Anomaly detection for unusual expenses
- Expense patterns and trends

### Export Data

Use the Export Data button to save your budget data as a JSON file.

## 🧠 ML Features

The application includes several machine learning features:

### Expense Prediction

The embedded ML model analyzes your spending history to predict:
- Expected expense amounts for each category
- Confidence levels for predictions
- Suggested minimum and maximum ranges

### Anomaly Detection

The application identifies unusual expenses by:
- Comparing with historical spending patterns
- Calculating statistical deviations
- Providing warnings for outlier expenses

### Trend Analysis

ML algorithms detect patterns in your expenses:
- Identifies increasing or decreasing trends
- Calculates trend percentages
- Provides insights based on spending trajectories

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Created by [Avishek Paul](https://github.com/avishekpaul1310)
