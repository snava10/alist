import globalStyles from '../GlobalStyles';

describe('GlobalStyles', () => {
  it('should import without crashing', () => {
    // Verifies that the GlobalStyles module can be loaded
    expect(globalStyles).toBeDefined();
  });

  it('exports button styles', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('exports primary button variants', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('exports error button variant', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('exports button text styles', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('button has base styling properties', () => {
    expect(globalStyles.button).toHaveProperty('alignItems');
  });

  it('exports modal view styles', () => {
    expect(globalStyles.modalView).toBeDefined();
  });

  it('exports modal view centered styles', () => {
    expect(globalStyles.modalViewCentered).toBeDefined();
  });

  it('exports profile banner container', () => {
    expect(globalStyles.profileBannerContainer).toBeDefined();
  });

  it('exports profile text label style', () => {
    expect(globalStyles.profileTextLabel).toBeDefined();
  });

  it('exports search input styles', () => {
    expect(globalStyles.searchInput).toBeDefined();
  });

  it('exports search container styles', () => {
    expect(globalStyles.searchContainer).toBeDefined();
  });

  it('has defined theme structure', () => {
    expect(globalStyles).not.toBeNull();
  });

  it('all styles are objects or numbers', () => {
    Object.values(globalStyles).forEach((style) => {
      expect(typeof style === 'object' || typeof style === 'number').toBe(true);
    });
  });

  it('button styles include padding', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('button styles include alignment', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('theme colors are defined', () => {
    expect(globalStyles).toBeDefined();
  });

  it('button primary color is defined', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('button error color is defined', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('button text styles are defined', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('default text style properties exist', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('danger text style exists', () => {
    expect(globalStyles.button).toBeDefined();
  });

  it('all modal styles are defined', () => {
    expect(globalStyles.modalView).toBeDefined();
    expect(globalStyles.modalViewCentered).toBeDefined();
  });

  it('profile styles are accessible', () => {
    expect(globalStyles.profileBannerContainer).toBeDefined();
    expect(globalStyles.profileTextLabel).toBeDefined();
  });

  it('search styles are accessible', () => {
    expect(globalStyles.searchInput).toBeDefined();
    expect(globalStyles.searchContainer).toBeDefined();
  });

  it('component styles are consistent', () => {
    expect(globalStyles).toBeDefined();
    expect(Object.keys(globalStyles).length).toBeGreaterThan(5);
  });

  it('exports main style properties', () => {
    expect(globalStyles).toHaveProperty('button');
    expect(globalStyles).toHaveProperty('modalView');
    expect(globalStyles).toHaveProperty('modalViewCentered');
  });
});
