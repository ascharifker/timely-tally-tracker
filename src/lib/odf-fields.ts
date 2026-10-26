/** Production tube identity uses the legacy jobs.tube_spec column, not the PO specification. */
export function odfProductionFields(input: {
  tube_number: string;
  customer_date: string | null;
  export_date: string | null;
}) {
  const tubeNumber = input.tube_number.trim();
  if (!tubeNumber) throw new Error("Número de Tubo es obligatorio");
  return {
    tube_spec: tubeNumber,
    customer_date: input.customer_date,
    export_date: input.export_date,
  };
}