/*
 * MIT License
 *
 * Copyright (c) 2020 Sarad Mohanan(https://sarad.in/)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const var_charges = "charges";
const var_exchange_based = "exchange_based";

const segmentEquityIntraday = "EQ_I";
const segmentEquityDelivery = "EQ_D";
const segmentFNOFutures = "FUT";
const segmentFNOOptions = "OPT";
const availableSegments = [segmentEquityIntraday, segmentEquityDelivery, segmentFNOFutures, segmentFNOOptions];

const exchangeNSE = "NSE";
const exchangeBSE = "BSE";
const availableExchanges = [exchangeNSE, exchangeBSE];

const chargeBrokerage = "Brokerage";
const chargeSTT = "STT";
const chargeTransaction = "Transaction";
const chargeGST = "GST";
const chargeSEBI = "SEBI";
const chargeStamp = "Stamp";

const allCharges = {
  [segmentEquityIntraday]: {
    [chargeBrokerage]: {[var_charges]: [0.03, 20, Math.min]},
    [chargeSTT]: {[var_charges]: [0.025]},
    [chargeTransaction]: {
      [var_exchange_based]: true,
      [exchangeNSE]: {[var_charges]: [0.00325]},
      [exchangeBSE]: {[var_charges]: [0.003]},
    },
    [chargeGST]: {[var_charges]: [18]},
    [chargeStamp]: {[var_charges]: [0.003]}
  },
  [segmentEquityDelivery]: {
    [chargeBrokerage]: {[var_charges]: [0, 0, Math.min]},
    [chargeSTT]: {[var_charges]: [0.1]},
    [chargeTransaction]: {
      [var_exchange_based]: true,
      [exchangeNSE]: {[var_charges]: [0.00325]},
      [exchangeBSE]: {[var_charges]: [0.003]},
    },
    [chargeGST]: {[var_charges]: [18]},
    [chargeStamp]: {[var_charges]: [0.015]}
  },
  [segmentFNOFutures]: {
    [chargeBrokerage]: {[var_charges]: [0.03, 20, Math.min]},
    [chargeSTT]: {[var_charges]: [0.01]},
    [chargeTransaction]: {
      [var_exchange_based]: true,
      [exchangeNSE]: {[var_charges]: [0.0019]}
    },
    [chargeGST]: {[var_charges]: [18]},
    [chargeStamp]: {[var_charges]: [0.002]}
  },
  [segmentFNOOptions]: {
    [chargeBrokerage]: {[var_charges]: [0, 20, Math.max]},
    [chargeSTT]: {[var_charges]: [0.05]},
    [chargeTransaction]: {
      [var_exchange_based]: true,
      [exchangeNSE]: {[var_charges]: [0.05]}
    },
    [chargeGST]: {[var_charges]: [18]},
    [chargeStamp]: {[var_charges]: [0.003]}
  }
};

let round = function(number) {
  return Math.round((number + Number.EPSILON) * 100) / 100;
};

let getPercentageCharge = function(percentage, amount) {
  return round((amount / 100) * percentage);
};

let calculateCharge = function(segment, chargeType, exchange, amount) {
  let chargeObject = allCharges[segment][chargeType];
  if (chargeObject[var_exchange_based]) {
    chargeObject = chargeObject[exchange];
    if (chargeObject === undefined) {
      throw new Error(`Exchange ${exchange} not available in segment ${segment}.`)
    }
  }

  let percentageCharge = getPercentageCharge(chargeObject[var_charges][0], amount);
  if (chargeObject[var_charges].length === 1) {
    return percentageCharge;
  }

  return chargeObject[var_charges][2](percentageCharge, chargeObject[var_charges][1]);
};

/**
 * Calculate Zerodha Brokerage
 * https://zerodha.com/charges#tab-equities
 * https://zerodha.com/brokerage-calculator#tab-equities
 *
 * @param {number} buy price the script was bought at.
 * @param {number} sell price the script was sold at.
 * @param {number} quantity quantity of the script.
 * @param {string} segment available segments are EQ_I(Equity Intraday), EQ_D(Equity Delivery), FUT(F&O - Futures), OPT(F&O - Options).
 * @param {string} exchange exchange the script was traded at. Available Exchanges NSE and BSE.
 * @return {number} Brokerage for the trade performed in Zerodha.
 * @customfunction
 */
function Z_BROKERAGE(buy, sell, quantity, segment, exchange) {
  if (availableSegments.indexOf(segment) === -1) {
    throw new Error(`Unknown segment ${segment}.`);
  }

  if (availableExchanges.indexOf(exchange) === -1) {
    throw new Error(`Unknown exchange ${exchange}.`);
  }

  let turnover = Z_BROKERAGE_TURNOVER(buy, sell, quantity);
  let brokerage = Z_BROKERAGE_BROKERAGE(buy, sell, quantity, segment, exchange);
  let stt = Z_BROKERAGE_STT(buy, sell, quantity, segment, exchange);
  let transaction = Z_BROKERAGE_TRANSACTION(turnover, segment, exchange);
  let gst = Z_BROKERAGE_GST(brokerage, transaction, segment, exchange);
  let sebi = Z_BROKERAGE_SEBI(turnover);
  let stamp = Z_BROKERAGE_STAMP(buy, quantity, segment, exchange);
  let dp = Z_BROKERAGE_DP(segment);

  return brokerage + stt + transaction + gst + sebi + stamp + dp;
}

/**
 * Get turnover of a trade.
 *
 * @param {number} buy price the script was bought at.
 * @param {number} sell price the script was sold at.
 * @param {number} quantity quantity of the script.
 * @return {number} Turnover of the trade.
 * @customfunction
 */
function Z_BROKERAGE_TURNOVER(buy, sell, quantity) {
  return (buy * quantity) + (sell * quantity);
}

/**
 * Get Brokerage charged by Zerodha.
 *
 * @param {number} buy price the script was bought at.
 * @param {number} sell price the script was sold at.
 * @param {number} quantity quantity of the script.
 * @param {string} segment available segments are EQ_I(Equity Intraday), EQ_D(Equity Delivery), FUT(F&O - Futures), OPT(F&O - Options).
 * @param {string} exchange exchange the script was traded at. Available Exchanges NSE and BSE.
 * @return {number} Brokerage charged by Zerodha.
 * @customfunction
 */
function Z_BROKERAGE_BROKERAGE(buy, sell, quantity, segment, exchange) {
  let buyBrokerage = calculateCharge(segment, chargeBrokerage, exchange, (buy * quantity));
  let sellBrokerage = calculateCharge(segment, chargeBrokerage, exchange, (sell * quantity));
  return buyBrokerage + sellBrokerage;
}

/**
 * Get STT of a trade.
 *
 * @param {number} buy price the script was bought at.
 * @param {number} sell price the script was sold at.
 * @param {number} quantity quantity of the script.
 * @param {string} segment available segments are EQ_I(Equity Intraday), EQ_D(Equity Delivery), FUT(F&O - Futures), OPT(F&O - Options).
 * @param {string} exchange exchange the script was traded at. Available Exchanges NSE and BSE.
 * @return {number} STT of the trade.
 * @customfunction
 */
function Z_BROKERAGE_STT(buy, sell, quantity, segment, exchange) {
  let amount = sell * quantity;
  if (segment === segmentEquityDelivery) {
    amount += buy * quantity;
  }
  return calculateCharge(segment, chargeSTT, exchange, amount)
}

/**
 * Get Transaction Charges of a trade.
 *
 * @param {number} turnover response of Z_BROKERAGE_TURNOVER.
 * @param {string} segment available segments are EQ_I(Equity Intraday), EQ_D(Equity Delivery), FUT(F&O - Futures), OPT(F&O - Options).
 * @param {string} exchange exchange the script was traded at. Available Exchanges NSE and BSE.
 * @return {number} Transaction Charges of the trade.
 * @customfunction
 */
function Z_BROKERAGE_TRANSACTION(turnover, segment, exchange) {
  return calculateCharge(segment, chargeTransaction, exchange, turnover);
}

/**
 * Get GST Charges of a trade.
 *
 * @param {number} brokerage response of Z_BROKERAGE_BROKERAGE.
 * @param {number} transaction response of Z_BROKERAGE_TRANSACTION.
 * @param {string} segment available segments are EQ_I(Equity Intraday), EQ_D(Equity Delivery), FUT(F&O - Futures), OPT(F&O - Options).
 * @param {string} exchange exchange the script was traded at. Available Exchanges NSE and BSE.
 * @return {number} GST Charges of the trade.
 * @customfunction
 */
function Z_BROKERAGE_GST(brokerage, transaction, segment, exchange) {
  return calculateCharge(segment, chargeGST, exchange, brokerage + transaction);
}

/**
 * Get SEBI Charges of a trade.
 *
 * @param {number} turnover response of Z_BROKERAGE_TURNOVER.
 * @return {number} SEBI Charges of the trade.
 * @customfunction
 */
function Z_BROKERAGE_SEBI(turnover) {
  return round(turnover * (5/10000000))
}

/**
 * Get Stamp Duty Charges of a trade.
 *
 * @param {number} buy price the script was bought at.
 * @param {number} quantity quantity of the script.
 * @param {string} segment avialble segments are EQ_I(Equity Intraday), EQ_D(Equity Delivery), FUT(F&O - Futures), OPT(F&O - Options).
 * @param {string} exchange exchange the script was traded at. Available Exchanges NSE and BSE.
 * @return {number} Stamp Duty Charges of the trade.
 * @customfunction
 */
function Z_BROKERAGE_STAMP(buy, quantity, segment, exchange) {
  return calculateCharge(segment, chargeStamp, exchange, buy * quantity);
}

/**
 * Get DP Charges of a trade.
 *
 * @param {string} segment available segments are EQ_I(Equity Intraday), EQ_D(Equity Delivery), FUT(F&O - Futures), OPT(F&O - Options).
 * @return {number} DP Charges of the trade.
 * @customfunction
 */
function Z_BROKERAGE_DP(segment) {
  return segment === segmentEquityDelivery ? 15.93 : 0;
}
