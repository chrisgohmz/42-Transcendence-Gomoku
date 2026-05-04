type FieldErrorListProps = {
  errors?: string[];
  id: string;
};

export function FieldErrorList({ errors, id }: FieldErrorListProps) {
  if (!errors?.length) {
    return null;
  }

  return (
    <ul className="field-errors" id={id}>
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}
