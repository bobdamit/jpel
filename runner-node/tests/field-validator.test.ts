import { FieldType } from '../src/models/common-types';
import { FieldValidator } from '../src/field-validator';
import { Field } from '../src/models/process-types';

describe('FieldValidator', () => {
	describe('validateField', () => {
		it('should pass validation for required field with valid value', () => {
			const field: Field = {
				name: 'testField',
				type: FieldType.Text,
				required: true,
			};

			const result = FieldValidator.validateField(field, 'valid value');
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should fail validation for required field with empty value', () => {
			const field: Field = {
				name: 'testField',
				type: FieldType.Text,
				required: true,
			};

			const result = FieldValidator.validateField(field, '');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('testField is required');
		});

		it('should pass validation for optional field with empty value', () => {
			const field: Field = {
				name: 'testField',
				type: FieldType.Text,
				required: false,
			};

			const result = FieldValidator.validateField(field, '');
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate text field patterns', () => {
			const field: Field = {
				name: 'email',
				type: FieldType.Text,
				required: true,
				pattern: '^[^@]+@[^@]+\\.[^@]+$',
				patternDescription: 'Must be a valid email address',
			};

			const validResult = FieldValidator.validateField(field, 'test@example.com');
			expect(validResult.isValid).toBe(true);

			const invalidResult = FieldValidator.validateField(field, 'invalid-email');
			expect(invalidResult.isValid).toBe(false);
			expect(invalidResult.errors).toContain('email: Must be a valid email address');
		});

		it('should validate text field length constraints', () => {
			const field: Field = {
				name: 'username',
				type: FieldType.Text,
				required: true,
				min: 3,
				max: 10,
			};

			const tooShort = FieldValidator.validateField(field, 'ab');
			expect(tooShort.isValid).toBe(false);
			expect(tooShort.errors).toContain('username must be at least 3 characters long');

			const tooLong = FieldValidator.validateField(field, 'thisiswaytoolong');
			expect(tooLong.isValid).toBe(false);
			expect(tooLong.errors).toContain('username must be no more than 10 characters long');

			const justRight = FieldValidator.validateField(field, 'validuser');
			expect(justRight.isValid).toBe(true);
		});

		it('should validate number fields', () => {
			const field: Field = {
				name: 'age',
				type: FieldType.Number,
				required: true,
				min: 0,
				max: 120,
			};

			const validResult = FieldValidator.validateField(field, 25);
			expect(validResult.isValid).toBe(true);

			const tooLow = FieldValidator.validateField(field, -5);
			expect(tooLow.isValid).toBe(false);
			expect(tooLow.errors).toContain('age must be at least 0');

			const tooHigh = FieldValidator.validateField(field, 150);
			expect(tooHigh.isValid).toBe(false);
			expect(tooHigh.errors).toContain('age must be no more than 120');
		});

		it('should validate select fields', () => {
			const field: Field = {
				name: 'priority',
				type: FieldType.Select,
				required: true,
				options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }],
			};

			const validResult = FieldValidator.validateField(field, 'medium');
			expect(validResult.isValid).toBe(true);

			const invalidResult = FieldValidator.validateField(field, 'urgent');
			expect(invalidResult.isValid).toBe(false);
			expect(invalidResult.errors).toContain('priority must be one of: low, medium, high');
		});

		it('should validate boolean fields', () => {
			const field: Field = {
				name: 'agreeToTerms',
				type: FieldType.Boolean,
				required: true,
			};

			const validResult = FieldValidator.validateField(field, true);
			expect(validResult.isValid).toBe(true);

			const invalidResult = FieldValidator.validateField(field, 'yes');
			expect(invalidResult.isValid).toBe(false);
			expect(invalidResult.errors).toContain('agreeToTerms must be true or false');
		});

		it('should validate date fields', () => {
			const field: Field = {
				name: 'birthDate',
				type: FieldType.Date,
				required: true,
			};

			const validResult = FieldValidator.validateField(field, '2023-01-01');
			expect(validResult.isValid).toBe(true);

			const invalidResult = FieldValidator.validateField(field, 'not-a-date');
			expect(invalidResult.isValid).toBe(false);
			expect(invalidResult.errors).toContain('birthDate must be a valid date');
		});

		it('should handle invalid regex patterns gracefully', () => {
			const field: Field = {
				name: 'testField',
				type: FieldType.Text,
				required: true,
				pattern: '[invalid regex',
			};

			const result = FieldValidator.validateField(field, 'test');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('testField: Invalid pattern configuration');
		});
	});

	describe('validateFields', () => {
		it('should validate multiple fields and return combined results', () => {
			const fields: Field[] = [
				{
					name: 'name',
					type: FieldType.Text,
					required: true,
					min: 2,
				},
				{
					name: 'email',
					type: FieldType.Text,
					required: true,
					pattern: '^[^@]+@[^@]+\\.[^@]+$',
				},
				{
					name: 'age',
					type: FieldType.Number,
					required: false,
					min: 0,
				},
			];

			const data = {
				name: 'John',
				email: 'john@example.com',
				age: 25,
			};

			const result = FieldValidator.validateFields(fields, data);
			expect(result.isValid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('should collect errors from multiple invalid fields', () => {
			const fields: Field[] = [
				{
					name: 'name',
					type: FieldType.Text,
					required: true,
					min: 5,
				},
				{
					name: 'email',
					type: FieldType.Text,
					required: true,
					pattern: '^[^@]+@[^@]+\\.[^@]+$',
				},
			];

			const data = {
				name: 'Jo', // Too short
				email: 'invalid-email', // Invalid format
			};

			const result = FieldValidator.validateFields(fields, data);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('name must be at least 5 characters long');
			expect(result.errors).toContain('email: Value must match pattern: ^[^@]+@[^@]+\\.[^@]+$');
		});

		it('should handle missing fields in data', () => {
			const fields: Field[] = [
				{
					name: 'name',
					type: FieldType.Text,
					required: true,
				},
				{
					name: 'email',
					type: FieldType.Text,
					required: false,
				},
			];

			const data = {
				name: 'John',
				// email is missing
			};

			const result = FieldValidator.validateFields(fields, data);
			expect(result.isValid).toBe(true); // email is optional
			expect(result.errors).toEqual([]);
		});
	});
});