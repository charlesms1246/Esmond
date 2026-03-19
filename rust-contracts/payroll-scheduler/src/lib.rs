// SPDX-License-Identifier: MIT
//
// PayrollScheduler — pallet_revive PVM contract
//
// Compiled to RISC-V PVM bytecode via the `revive` CLI tool.
// Do NOT use cargo-contract (that is for ink!, which is discontinued).
//
// Build command: revive build --release
// Output: target/release/payroll_scheduler.polkavm
//
// This contract is STATELESS: no storage, no token access, no admin key.
// It is a pure computation module — attack surface is zero.
//
// ABI-compatible with Solidity callers via the Dual VM Stack.
// Accepts and returns arrays via standard ABI encoding (pallet_revive handles the boundary).

/// Compute which employees are due for payment and their amounts.
///
/// Filtering logic:
///   For each employee i:
///     1. If next_payment_due[i] > current_timestamp → skip (not due yet)
///     2. If salaries[i] > approved_caps[i] → skip (cap exceeded)
///     3. Otherwise → include (employees[i], salaries[i]) in output
///
/// Returns two parallel arrays of equal length: (due_employees, amounts).
/// amounts[i] always equals the employee's salary — NOT the cap.
pub fn compute_payroll(
    employees: Vec<[u8; 20]>,        // H160 address as raw bytes
    salaries: Vec<u128>,             // amount in token base units
    next_payment_due: Vec<u64>,      // Unix timestamps
    approved_caps: Vec<u128>,        // per-employee spend caps
    current_timestamp: u64,
) -> (Vec<[u8; 20]>, Vec<u128>) {   // (due_employees, amounts)
    let len = employees.len();

    // Guard: all input arrays must be the same length
    if salaries.len() != len
        || next_payment_due.len() != len
        || approved_caps.len() != len
    {
        // Return empty on malformed input — do not panic
        return (Vec::new(), Vec::new());
    }

    let mut due_employees: Vec<[u8; 20]> = Vec::new();
    let mut amounts: Vec<u128> = Vec::new();

    for i in 0..len {
        // Filter 1: is this employee due?
        if next_payment_due[i] > current_timestamp {
            continue;
        }
        // Filter 2: does salary fit within cap?
        if salaries[i] > approved_caps[i] {
            continue;
        }
        // Include — amount is salary, not cap
        due_employees.push(employees[i]);
        amounts.push(salaries[i]);
    }

    (due_employees, amounts)
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // Helper: make a fake H160 address from a single byte
    fn addr(b: u8) -> [u8; 20] {
        let mut a = [0u8; 20];
        a[0] = b;
        a
    }

    // ── Filtering logic ───────────────────────────────────────────────────────

    #[test]
    fn all_employees_due() {
        let employees = vec![addr(1), addr(2), addr(3)];
        let salaries = vec![1000u128, 2000, 3000];
        let next_due = vec![100u64, 100, 100];
        let caps = vec![5000u128, 5000, 5000];
        let now = 200u64;

        let (due, amounts) = compute_payroll(employees.clone(), salaries.clone(), next_due, caps, now);
        assert_eq!(due.len(), 3);
        assert_eq!(amounts.len(), 3);
        assert_eq!(due, employees);
        assert_eq!(amounts, salaries);
    }

    #[test]
    fn no_employees_due() {
        let employees = vec![addr(1), addr(2)];
        let salaries = vec![1000u128, 2000];
        let next_due = vec![500u64, 600];
        let caps = vec![5000u128, 5000];
        let now = 100u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 0);
        assert_eq!(amounts.len(), 0);
    }

    #[test]
    fn mixed_due_not_due() {
        let employees = vec![addr(1), addr(2), addr(3)];
        let salaries = vec![1000u128, 2000, 3000];
        // employee 0 and 2 are due, employee 1 is not
        let next_due = vec![100u64, 500, 100];
        let caps = vec![5000u128, 5000, 5000];
        let now = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 2);
        assert_eq!(due[0], addr(1));
        assert_eq!(due[1], addr(3));
        assert_eq!(amounts[0], 1000);
        assert_eq!(amounts[1], 3000);
    }

    #[test]
    fn empty_input_returns_empty() {
        let (due, amounts) = compute_payroll(vec![], vec![], vec![], vec![], 1000);
        assert_eq!(due.len(), 0);
        assert_eq!(amounts.len(), 0);
    }

    #[test]
    fn exactly_on_due_timestamp_is_included() {
        // next_payment_due[i] == current_timestamp → included (<=)
        let employees = vec![addr(1)];
        let salaries = vec![500u128];
        let next_due = vec![100u64];
        let caps = vec![1000u128];
        let now = 100u64;  // exactly equal

        let (due, amounts) = compute_payroll(employees.clone(), salaries.clone(), next_due, caps, now);
        assert_eq!(due.len(), 1);
        assert_eq!(due[0], addr(1));
        assert_eq!(amounts[0], 500);
    }

    #[test]
    fn one_second_past_due_is_included() {
        let employees = vec![addr(1)];
        let salaries = vec![500u128];
        let next_due = vec![100u64];
        let caps = vec![1000u128];
        let now = 101u64;  // 1 second past due

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 1);
        assert_eq!(amounts[0], 500);
    }

    // ── Cap enforcement ───────────────────────────────────────────────────────

    #[test]
    fn salary_exceeds_cap_excluded() {
        let employees = vec![addr(1)];
        let salaries = vec![2000u128];   // salary > cap
        let next_due = vec![100u64];
        let caps = vec![1000u128];       // cap < salary
        let now = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 0);
        assert_eq!(amounts.len(), 0);
    }

    #[test]
    fn salary_equals_cap_exactly_included() {
        let employees = vec![addr(1)];
        let salaries = vec![1000u128];   // salary == cap
        let next_due = vec![100u64];
        let caps = vec![1000u128];       // cap == salary
        let now = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 1);
        assert_eq!(amounts[0], 1000);
    }

    #[test]
    fn salary_under_cap_included() {
        let employees = vec![addr(1)];
        let salaries = vec![500u128];    // salary < cap
        let next_due = vec![100u64];
        let caps = vec![1000u128];       // cap > salary
        let now = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 1);
        assert_eq!(amounts[0], 500);
    }

    #[test]
    fn all_cap_exceeded_returns_empty() {
        let employees = vec![addr(1), addr(2), addr(3)];
        let salaries = vec![2000u128, 3000, 4000];
        let next_due = vec![100u64, 100, 100];
        let caps = vec![1000u128, 1000, 1000];  // all caps < salaries
        let now = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 0);
        assert_eq!(amounts.len(), 0);
    }

    #[test]
    fn mixed_due_cap_scenarios() {
        // Employee 0: due, within cap → included
        // Employee 1: due, cap exceeded → excluded
        // Employee 2: not due, within cap → excluded
        // Employee 3: not due, cap exceeded → excluded
        let employees = vec![addr(1), addr(2), addr(3), addr(4)];
        let salaries = vec![500u128, 2000, 500, 2000];
        let next_due = vec![100u64, 100, 500, 500];
        let caps = vec![1000u128, 1000, 1000, 1000];
        let now = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 1);
        assert_eq!(due[0], addr(1));
        assert_eq!(amounts[0], 500);
    }

    // ── Return value correctness ──────────────────────────────────────────────

    #[test]
    fn output_arrays_always_equal_length() {
        let employees = vec![addr(1), addr(2), addr(3)];
        let salaries = vec![100u128, 200, 300];
        let next_due = vec![50u64, 50, 500];
        let caps = vec![1000u128, 1000, 1000];
        let now = 100u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), amounts.len());
    }

    #[test]
    fn amounts_contain_salaries_not_caps() {
        // Verify amounts = salaries, not caps
        let employees = vec![addr(1), addr(2)];
        let salaries = vec![300u128, 700];
        let next_due = vec![100u64, 100];
        let caps = vec![5000u128, 9000];  // caps are much larger than salaries
        let now = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 2);
        assert_eq!(amounts[0], 300);  // salary, not cap (5000)
        assert_eq!(amounts[1], 700);  // salary, not cap (9000)
    }

    #[test]
    fn output_is_subset_of_input() {
        let employees = vec![addr(10), addr(20), addr(30), addr(40)];
        let salaries = vec![100u128, 200, 300, 400];
        let next_due = vec![50u64, 50, 500, 50];
        let caps = vec![1000u128, 50, 1000, 1000];  // employee 1 cap < salary
        let now = 100u64;

        let (due, _amounts) = compute_payroll(employees.clone(), salaries, next_due, caps, now);

        // All returned addresses must be in the original employees list
        for d in &due {
            assert!(employees.contains(d), "Output address not in input: {:?}", d);
        }

        // Should contain addr(10) and addr(40) — not addr(20) (cap) or addr(30) (not due)
        assert!(due.contains(&addr(10)));
        assert!(due.contains(&addr(40)));
        assert!(!due.contains(&addr(20)));
        assert!(!due.contains(&addr(30)));
    }

    // ── Edge / overflow safety ────────────────────────────────────────────────

    #[test]
    fn large_timestamp_values_no_overflow() {
        // nextDue = u64::MAX - 1, currentTimestamp = u64::MAX — should include, no panic
        let employees = vec![addr(1)];
        let salaries  = vec![100u128];
        let next_due  = vec![u64::MAX - 1];
        let caps      = vec![200u128];
        let now       = u64::MAX;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 1);
        assert_eq!(amounts[0], 100);
    }

    #[test]
    fn large_amounts_no_overflow() {
        // salary = u128::MAX / 2, cap = u128::MAX — should include with correct amount
        let employees = vec![addr(1)];
        let salary    = u128::MAX / 2;
        let salaries  = vec![salary];
        let next_due  = vec![100u64];
        let caps      = vec![u128::MAX];
        let now       = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 1);
        assert_eq!(amounts[0], salary);  // amount = salary, not cap
    }

    #[test]
    fn single_employee_always_correct() {
        // Case 1: due + within cap → included
        let (due, amounts) = compute_payroll(
            vec![addr(1)], vec![50u128], vec![100u64], vec![100u128], 200u64,
        );
        assert_eq!(due.len(), 1);
        assert_eq!(amounts[0], 50);

        // Case 2: due + cap exceeded → excluded
        let (due, _) = compute_payroll(
            vec![addr(1)], vec![200u128], vec![100u64], vec![100u128], 200u64,
        );
        assert_eq!(due.len(), 0);

        // Case 3: not due + within cap → excluded
        let (due, _) = compute_payroll(
            vec![addr(1)], vec![50u128], vec![500u64], vec![100u128], 200u64,
        );
        assert_eq!(due.len(), 0);
    }

    #[test]
    fn mixed_due_not_due_returns_subset_five_employees() {
        // employees 0,2,4 are due; employees 1,3 are not
        let employees = vec![addr(0), addr(1), addr(2), addr(3), addr(4)];
        let salaries  = vec![10u128, 20, 30, 40, 50];
        let next_due  = vec![100u64, 500, 100, 600, 100];
        let caps      = vec![100u128; 5];
        let now       = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 3);
        assert_eq!(due[0], addr(0));
        assert_eq!(due[1], addr(2));
        assert_eq!(due[2], addr(4));
        assert_eq!(amounts, vec![10u128, 30, 50]);
    }

    #[test]
    fn mixed_due_and_cap_scenarios_all_handled() {
        // employee 0: due, within cap → included
        // employee 1: due, cap exceeded → excluded
        // employee 2: not due, within cap → excluded
        // employee 3: not due, cap exceeded → excluded
        // employee 4: due, salary == cap → included
        let employees = vec![addr(0), addr(1), addr(2), addr(3), addr(4)];
        let salaries  = vec![50u128, 200, 50, 200, 100];
        let next_due  = vec![100u64, 100, 500, 500, 100];
        let caps      = vec![100u128, 100, 100, 100, 100];
        let now       = 200u64;

        let (due, amounts) = compute_payroll(employees, salaries, next_due, caps, now);
        assert_eq!(due.len(), 2);
        assert_eq!(due[0], addr(0));
        assert_eq!(due[1], addr(4));
        assert_eq!(amounts[0], 50);
        assert_eq!(amounts[1], 100); // salary == cap, included
    }

    #[test]
    fn output_arrays_equal_length_for_zero_one_all_due() {
        let employees = vec![addr(1), addr(2), addr(3)];
        let salaries  = vec![10u128, 20, 30];
        let caps      = vec![100u128, 100, 100];

        // Zero due
        let (due, amts) = compute_payroll(
            employees.clone(), salaries.clone(), vec![500u64, 500, 500], caps.clone(), 100u64,
        );
        assert_eq!(due.len(), amts.len());

        // One due
        let (due, amts) = compute_payroll(
            employees.clone(), salaries.clone(), vec![50u64, 500, 500], caps.clone(), 100u64,
        );
        assert_eq!(due.len(), amts.len());
        assert_eq!(due.len(), 1);

        // All due
        let (due, amts) = compute_payroll(
            employees.clone(), salaries.clone(), vec![50u64, 50, 50], caps.clone(), 100u64,
        );
        assert_eq!(due.len(), amts.len());
        assert_eq!(due.len(), 3);
    }
}
