'use strict';

/* eslint-env mocha */
describe('Timeline-Viewer index.html page', () => {
  beforeEach(() => {
    cy
      .server()
      .visitIndex();
  });

  context('Authorize button', () => {
    it('should be visible', () => {
      // wait for script checking auth
      cy.wait(2000);
      cy.get('#auth').should('be.visible');
    });
  });

  context('Online status', () => {
    it('should be shown', () => {
      cy.get('#online-status').should('be.visible');
    });
  });
});
