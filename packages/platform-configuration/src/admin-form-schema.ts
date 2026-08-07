export type AdminFormFieldType =
  'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'multiselect' | 'json';

export interface AdminFormField {
  id: string;
  label: string;
  type: AdminFormFieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: readonly string[];
}

export interface AdminFormSection {
  id: string;
  title: string;
  description?: string;
  fields: readonly AdminFormField[];
}

export interface AdminFormSchema {
  id: string;
  title: string;
  description?: string;
  sections: readonly AdminFormSection[];
}
