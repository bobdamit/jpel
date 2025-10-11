import ProcessLoader from '../src/process-loader';

describe('ProcessNormalizer', () => {
    test('validates and normalizes a correct process definition', () => {
        const pd: any = {
            id: 'p1',
            name: 'Test Process',
            start: 'a:start',
            activities: {
                start: { type: 'terminate' },
                a1: { type: 'human', inputs: [{ name: 'agree', type: 'boolean' }] }
            }
        };

        const validation = ProcessLoader.validate(pd);
        expect(validation.valid).toBe(true);
        expect(validation.errors.length).toBe(0);

        ProcessLoader.normalize(pd);
        expect(pd.activities.start.id).toBe('start');
        expect(pd.activities.a1.id).toBe('a1');
    });

    test('reports errors for missing required fields', () => {
        const pd: any = { activities: {} };
        const validation = ProcessLoader.validate(pd);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Missing required field: id');
        expect(validation.errors).toContain('Missing required field: name');
    });

    test('warns for checkbox field type and normalizes to boolean', () => {
        const pd: any = {
            id: 'p2',
            name: 'Checkbox Process',
            start: 'a:start',
            activities: {
                start: { type: 'human', inputs: [{ name: 'active', type: 'checkbox' }] }
            }
        };

        const validation = ProcessLoader.validate(pd);
        expect(validation.valid).toBe(true);
        expect(validation.warnings.length).toBeGreaterThan(0);

        ProcessLoader.normalize(pd);
        expect(pd.activities.start.inputs[0].type).toBe('boolean');
    });

    test('errors when an activity is missing type', () => {
        const pd: any = {
            id: 'p3',
            name: 'Bad Activity',
            start: 'a:start',
            activities: {
                start: { }
            }
        };
        const validation = ProcessLoader.validate(pd);
        expect(validation.valid).toBe(false);
        expect(validation.errors.some(e => e.includes("Activity 'start' missing required field: type"))).toBe(true);
    });

    test('errors when start references missing activity', () => {
        const pd: any = {
            id: 'p4',
            name: 'Start Missing',
            start: 'a:missing',
            activities: {
                start: { type: 'terminate' }
            }
        };

        const validation = ProcessLoader.validate(pd);
        expect(validation.valid).toBe(false);
        expect(validation.errors.some(e => e.includes("Start activity reference"))).toBe(true);
    });

    test('errors when sequence references unknown activity', () => {
        const pd: any = {
            id: 'p5',
            name: 'Seq Bad',
            start: 'a:seq1',
            activities: {
                seq1: { type: 'sequence', activities: ['a:doesNotExist'] },
                other: { type: 'terminate' }
            }
        };

        const validation = ProcessLoader.validate(pd);
        expect(validation.valid).toBe(false);
        expect(validation.errors.some(e => e.includes("references unknown activity"))).toBe(true);
    });
});
