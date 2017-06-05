describe('Timeline-Viewer index.html page', () => {
  beforeEach(() => {
    cy
      .server()
      .visitIndex();
  });

  context('Authorize button', () => {
    it('should be hidden before script checking auth', () => {
      cy.get('#auth').should('not.be.visible');
    });
  });
});
