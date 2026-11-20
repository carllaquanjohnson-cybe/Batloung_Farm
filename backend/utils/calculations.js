// Business calculations — the server computes totals, never the client.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Total of a sale or purchase: Σ quantity × price per box
const calculateTotal = (lines, priceKey) =>
    round2(lines.reduce((sum, l) => sum + l.quantity * l[priceKey], 0));

// PAID / PARTIALLY_PAID / UNPAID from the total and amount received so far
const paymentStatus = (total, paid) =>
    paid >= total ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

// Outstanding amount the vendor still owes on a sale
const balance = (total, paid) => round2(Math.max(total - paid, 0));

// Merges repeated fruit+size lines so stock is checked against the combined quantity
const mergeLines = (items, extra = []) => {
    const map = new Map();
    for (const it of items) {
        const key = `${it.fruit_id}|${it.packaging_size}` + extra.map((k) => `|${it[k]}`).join('');
        if (map.has(key)) map.get(key).quantity += it.quantity;
        else map.set(key, { ...it });
    }
    return [...map.values()];
};

module.exports = { round2, calculateTotal, paymentStatus, balance, mergeLines };
