// backend/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

let database = [];

// Initialize the database with seed data
app.get('/initialize-database', async (req, res) => {
  try {
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    database = response.data;
    res.json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// List all transactions with search and pagination
app.get('/list-transactions', (req, res) => {
  const { month, search_text, page = 1, per_page = 10 } = req.query;

  const filteredTransactions = database.filter(transaction =>
    new Date(transaction.dateOfSale).getMonth() + 1 === parseInt(month) &&
    (search_text ? (
      transaction.title.includes(search_text) ||
      transaction.description.includes(search_text) ||
      transaction.price.toString().includes(search_text)
    ) : true)
  );

  const startIndex = (page - 1) * per_page;
  const endIndex = startIndex + parseInt(per_page);
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  res.json({ transactions: paginatedTransactions });
});

// Statistics API
app.get('/statistics', (req, res) => {
  const { month } = req.query;

  const totalSaleAmount = database
    .filter(transaction => new Date(transaction.dateOfSale).getMonth() + 1 === parseInt(month))
    .reduce((acc, transaction) => acc + transaction.price, 0);

  const soldItems = database.filter(transaction =>
    new Date(transaction.dateOfSale).getMonth() + 1 === parseInt(month)
  ).length;

  const notSoldItems = database.length - soldItems;

  res.json({ totalSaleAmount, soldItems, notSoldItems });
});

// Bar chart API
app.get('/bar-chart', (req, res) => {
  const { month } = req.query;

  const priceRanges = ['0-100', '101-200', '201-300', '301-400', '401-500', '501-600', '601-700', '701-800', '801-900', '901-above'];
  const barChartData = {};

  priceRanges.forEach(range => {
    const [lower, upper] = range.split('-').map(Number);
    const count = database.filter(transaction =>
      new Date(transaction.dateOfSale).getMonth() + 1 === parseInt(month) &&
      transaction.price >= lower && transaction.price <= upper
    ).length;

    barChartData[range] = count;
  });

  res.json({ bar_chart_data: barChartData });
});

// Pie chart API
app.get('/pie-chart', (req, res) => {
  const { month } = req.query;

  const uniqueCategories = [...new Set(database
    .filter(transaction => new Date(transaction.dateOfSale).getMonth() + 1 === parseInt(month))
    .map(transaction => transaction.category)
  )];

  const pieChartData = {};

  uniqueCategories.forEach(category => {
    const count = database.filter(transaction =>
      new Date(transaction.dateOfSale).getMonth() + 1 === parseInt(month) &&
      transaction.category === category
    ).length;

    pieChartData[category] = count;
  });

  res.json({ pie_chart_data: pieChartData });
});

// Combined API
app.get('/combined-response', async (req, res) => {
  const { month } = req.query;

  try {
    const initializeResponse = await axios.get(`http://localhost:${port}/initialize-database`);
    const listTransactionsResponse = await axios.get(`http://localhost:${port}/list-transactions?month=${month}`);
    const statisticsResponse = await axios.get(`http://localhost:${port}/statistics?month=${month}`);
    const barChartResponse = await axios.get(`http://localhost:${port}/bar-chart?month=${month}`);
    const pieChartResponse = await axios.get(`http://localhost:${port}/pie-chart?month=${month}`);

    const combinedResponse = {
      initialize: initializeResponse.data,
      list_transactions: listTransactionsResponse.data,
      statistics: statisticsResponse.data,
      bar_chart: barChartResponse.data,
      pie_chart: pieChartResponse.data,
    };

    res.json(combinedResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});