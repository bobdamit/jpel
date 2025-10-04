import { Field, FieldType } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class FieldValidator {
  
  /**
   * Validates a single field value against its field definition
   */
  static validateField(field: Field, value: any): ValidationResult {
    const errors: string[] = [];
    
    // Check required fields
    if (field.required && (value === null || value === undefined || value === '')) {
      errors.push(`${field.name} is required`);
      return { isValid: false, errors };
    }
    
    // Skip validation for empty optional fields
    if (!field.required && (value === null || value === undefined || value === '')) {
      return { isValid: true, errors: [] };
    }
    
    // Type-specific validation
    switch (field.type) {
      case FieldType.Text:
        this.validateTextField(field, value, errors);
        break;
      case FieldType.Number:
        this.validateNumberField(field, value, errors);
        break;
      case FieldType.Select:
        this.validateSelectField(field, value, errors);
        break;
      case FieldType.Date:
        this.validateDateField(field, value, errors);
        break;
      case FieldType.Boolean:
        this.validateBooleanField(field, value, errors);
        break;
    }
    
    return { isValid: errors.length === 0, errors };
  }
  
  /**
   * Validates all fields in a form submission
   */
  static validateFields(fields: Field[], formData: { [key: string]: any }): ValidationResult {
    const allErrors: string[] = [];
    
    for (const field of fields) {
      const value = formData[field.name];
      const result = this.validateField(field, value);
      if (!result.isValid) {
        allErrors.push(...result.errors);
      }
    }
    
    return { isValid: allErrors.length === 0, errors: allErrors };
  }
  
  private static validateTextField(field: Field, value: any, errors: string[]): void {
    const stringValue = String(value);
    
    // Pattern validation (regex)
    if (field.pattern) {
      try {
        const regex = new RegExp(field.pattern);
        if (!regex.test(stringValue)) {
          const description = field.patternDescription || `Value must match pattern: ${field.pattern}`;
          errors.push(`${field.name}: ${description}`);
        }
      } catch (error) {
        errors.push(`${field.name}: Invalid pattern configuration`);
      }
    }
    
    // Length validation
    if (field.min !== undefined && stringValue.length < field.min) {
      errors.push(`${field.name} must be at least ${field.min} characters long`);
    }
    
    if (field.max !== undefined && stringValue.length > field.max) {
      errors.push(`${field.name} must be no more than ${field.max} characters long`);
    }
  }
  
  private static validateNumberField(field: Field, value: any, errors: string[]): void {
    const numValue = Number(value);
    
    if (isNaN(numValue)) {
      errors.push(`${field.name} must be a valid number`);
      return;
    }
    
    if (field.min !== undefined && numValue < field.min) {
      errors.push(`${field.name} must be at least ${field.min}`);
    }
    
    if (field.max !== undefined && numValue > field.max) {
      errors.push(`${field.name} must be no more than ${field.max}`);
    }
  }
  
  private static validateSelectField(field: Field, value: any, errors: string[]): void {
    if (field.options && !field.options.includes(String(value))) {
      errors.push(`${field.name} must be one of: ${field.options.join(', ')}`);
    }
  }
  
  private static validateDateField(field: Field, value: any, errors: string[]): void {
    const dateValue = new Date(value);
    if (isNaN(dateValue.getTime())) {
      errors.push(`${field.name} must be a valid date`);
    }
  }
  
  private static validateBooleanField(field: Field, value: any, errors: string[]): void {
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
      errors.push(`${field.name} must be true or false`);
    }
  }
}