// Quick test code for McGill eligibility logic
const test1 = { cgpa: 3.8, province: "Quebec", casper_percentile: 40 };
const test2 = { cgpa: 3.6, province: "Quebec", casper_percentile: 25 };
const test3 = { cgpa: 4.0, province: "Ontario", casper_percentile: 70 };
const test4 = { cgpa: 3.85, province: " Ontario ", casper_percentile: 62 };

console.log(evalMcGill(test1)); // Expected: eligible
console.log(evalMcGill(test2)); // Expected: not-eligible
console.log(evalMcGill(test3)); // Expected: eligible
console.log(evalMcGill(test4)); // Expected: not-eligible
