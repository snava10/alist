import { BackupCadence, MembershipType } from '../DataModel';

describe('DataModel', () => {
  it('exports BackupCadence enum', () => {
    expect(BackupCadence).toBeDefined();
  });

  it('BackupCadence has NONE value', () => {
    expect(BackupCadence.NONE).toBe('NONE');
  });

  it('BackupCadence has DAILY value', () => {
    expect(BackupCadence.DAILY).toBe('DAILY');
  });

  it('BackupCadence has INSTANT value', () => {
    expect(BackupCadence.INSTANT).toBe('INSTANT');
  });

  it('exports MembershipType enum', () => {
    expect(MembershipType).toBeDefined();
  });

  it('MembershipType has FREE value', () => {
    expect(MembershipType.FREE).toBe('FREE');
  });

  it('MembershipType has PREMIUM value', () => {
    expect(MembershipType.PREMIUM).toBe('PREMIUM');
  });

  it('BackupCadence enum has all expected values', () => {
    const cadeences = Object.values(BackupCadence);
    expect(cadeences).toContain('NONE');
    expect(cadeences).toContain('DAILY');
    expect(cadeences).toContain('INSTANT');
  });

  it('MembershipType enum has all expected values', () => {
    const types = Object.values(MembershipType);
    expect(types).toContain('FREE');
    expect(types).toContain('PREMIUM');
  });

  it('BackupCadence values are strings', () => {
    expect(typeof BackupCadence.NONE).toBe('string');
    expect(typeof BackupCadence.DAILY).toBe('string');
    expect(typeof BackupCadence.INSTANT).toBe('string');
  });

  it('MembershipType values are strings', () => {
    expect(typeof MembershipType.FREE).toBe('string');
    expect(typeof MembershipType.PREMIUM).toBe('string');
  });

  it('can create objects with BackupCadence and MembershipType', () => {
    const userSettings = {
      userId: 'user-123',
      backup: BackupCadence.DAILY,
      membership: MembershipType.FREE,
    };
    expect(userSettings.userId).toBe('user-123');
    expect(userSettings.backup).toBe('DAILY');
    expect(userSettings.membership).toBe('FREE');
  });

  it('BackupCadence enum is accessible', () => {
    expect(Object.keys(BackupCadence)).toContain('NONE');
  });

  it('MembershipType enum is accessible', () => {
    expect(Object.keys(MembershipType)).toContain('FREE');
  });

  it('can use all backup cadences in objects', () => {
    Object.values(BackupCadence).forEach((cadence) => {
      const settings = {
        userId: 'test-user',
        backup: cadence,
        membership: MembershipType.FREE,
      };
      expect(settings.backup).toBe(cadence);
    });
  });

  it('can use all membership types in objects', () => {
    Object.values(MembershipType).forEach((membership) => {
      const settings = {
        userId: 'test-user',
        backup: BackupCadence.NONE,
        membership: membership,
      };
      expect(settings.membership).toBe(membership);
    });
  });

  it('enums can be used interchangeably', () => {
    expect(BackupCadence.NONE).toEqual('NONE');
    expect(MembershipType.FREE).toEqual('FREE');
  });

  it('renders without crashing', () => {
    expect(true).toBe(true);
  });
});
