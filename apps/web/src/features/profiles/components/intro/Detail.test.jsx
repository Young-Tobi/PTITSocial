import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Detail from './Detail';

test('a new profile without details can open, select and save a relationship', () => {
  const save = jest.fn();
  function NewProfile() {
    const [infos, setInfos] = useState(undefined);
    return (
      <Detail
        name="relationship"
        text="tình trạng quan hệ"
        rel
        infos={infos}
        handleChange={(event) => setInfos({ relationship: event.target.value })}
        updateDetails={() => save(infos)}
      />
    );
  }
  render(<NewProfile />);
  fireEvent.click(screen.getByText('Thêm tình trạng quan hệ'));
  const select = screen.getByRole('combobox');
  expect(select.value).toBe('');
  fireEvent.change(select, { target: { value: 'Single' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  expect(save).toHaveBeenCalledWith({ relationship: 'Single' });
  expect(screen.queryByRole('combobox')).toBeNull();
});
