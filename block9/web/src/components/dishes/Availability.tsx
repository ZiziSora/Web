

export function Availability({ value }: { value?: boolean }) {
  return <span className={'availability ' + (!value ? 'unavailable' : '')}><i aria-hidden="true" />{value ? 'Sẵn sàng phục vụ' : 'Tạm hết món'}</span>;
}
