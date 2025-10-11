import ProcessLoader from '../src/process-loader';
import { logger } from '../src/logger';
import { ProcessEngine } from '../src/process-engine';
import { RepositoryFactory } from '../src/repositories/repository-factory';

describe('Schema diagnostics and logging', () => {
    let errorSpy: any;

    beforeAll(() => {
        // Ensure logger captures errors for the test
        errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        errorSpy.mockRestore();
    });

    test('ProcessNormalizer logs individual AJV schema errors at ERROR', () => {
        // Create a process definition that will violate schema (extra property at root)
        const pd: any = {
            id: 'bad-schema',
            name: 'Bad Schema Process',
            start: 'a:start',
            activities: {
                start: { type: 'terminate' }
            },
            foobar: 'this-should-not-be-here'
        };

        const validation = ProcessLoader.validate(pd);

        expect(validation.valid).toBe(false);
        // At least one schema message should be present
        expect(validation.errors.some(e => typeof e === 'string' && e.startsWith('Schema:'))).toBe(true);

        // The normalizer should have logged the schema error individually
        const called = errorSpy.mock.calls.some((call: any) => {
            return call[0] === 'ProcessNormalizer: Schema validation error' || (call[1] && call[1].error && typeof call[1].error === 'string' && call[1].error.startsWith('Schema:'));
        });
        expect(called).toBe(true);
    });

    test('ProcessEngine.loadProcess throws on invalid process definition', async () => {
        // Ensure repositories are initialized for the engine
        await RepositoryFactory.initializeInMemory();
        const engine = new ProcessEngine();
        const pd: any = {
            id: 'bad-schema-2',
            name: 'Bad Schema Process 2',
            start: 'a:start',
            activities: {
                start: { type: 'terminate' }
            },
            extra: { nope: true }
        };

        await expect(engine.loadProcess(pd)).rejects.toThrow(/Process definition validation failed/);
    });
});
