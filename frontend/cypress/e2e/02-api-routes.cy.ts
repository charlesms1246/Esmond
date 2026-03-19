// frontend/cypress/e2e/02-api-routes.cy.ts

describe("API Routes", () => {
  it("GET /api/payroll returns correct shape", () => {
    cy.request("GET", "/api/payroll").then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("employees");
      expect(response.body).to.have.property("total");
      expect(response.body.employees).to.be.an("array");
      expect(response.body.total).to.be.a("number");
    });
  });

  it("GET /api/payroll employee fields are strings (bigint serialised)", () => {
    cy.request("GET", "/api/payroll").then((response) => {
      if (response.body.employees.length > 0) {
        const emp = response.body.employees[0];
        expect(emp.id).to.be.a("string");
        expect(emp.salaryAmount).to.be.a("string");
        expect(emp.payInterval).to.be.a("string");
        expect(emp.nextPaymentDue).to.be.a("string");
        expect(emp.approvedCap).to.be.a("string");
        expect(emp.parachainId).to.be.a("number");
        expect(emp.parachainName).to.be.a("string");
        expect(emp.active).to.be.a("boolean");
      }
    });
  });

  it("GET /api/payroll employee parachainName is resolved", () => {
    cy.request("GET", "/api/payroll").then((response) => {
      response.body.employees.forEach((emp: any) => {
        expect(emp.parachainName).to.not.be.empty;
        expect(emp.parachainName).to.not.include("undefined");
      });
    });
  });

  it("GET /api/milestones returns correct shape", () => {
    cy.request("GET", "/api/milestones").then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("milestones");
      expect(response.body).to.have.property("total");
      expect(response.body.milestones).to.be.an("array");
    });
  });

  it("GET /api/subscriptions returns correct shape", () => {
    cy.request("GET", "/api/subscriptions").then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("plans");
      expect(response.body).to.have.property("subscriptions");
      expect(response.body).to.have.property("totalPlans");
      expect(response.body).to.have.property("totalSubs");
      expect(response.body.plans).to.be.an("array");
      expect(response.body.subscriptions).to.be.an("array");
    });
  });

  it("GET /api/payroll total matches employees array length (within 50 cap)", () => {
    cy.request("GET", "/api/payroll").then((response) => {
      const { employees, total } = response.body;
      const displayedCount = employees.length;
      const expectedDisplayed = Math.min(total, 50);
      expect(displayedCount).to.eq(expectedDisplayed);
    });
  });
});
