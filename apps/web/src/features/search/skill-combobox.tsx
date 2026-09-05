import { useId, useState, type KeyboardEvent } from 'react';
import { CloseIcon } from '../../components/icons';
import { useSkillSuggestions } from './queries';

export function SkillCombobox({
  idPrefix,
  selected,
  onChange,
}: {
  idPrefix: string;
  selected: string[];
  onChange: (skills: string[]) => void;
}) {
  const generatedId = useId().replace(/:/gu, '');
  const inputId = `${idPrefix}-skill-${generatedId}`;
  const listId = `${inputId}-listbox`;
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = useSkillSuggestions(draft.trim(), open);
  const options = (query.data?.items ?? []).filter(
    (item) => !selected.includes(item.value),
  );

  const choose = (value: string) => {
    if (selected.length >= 10 || selected.includes(value)) return;
    onChange([...selected, value]);
    setDraft('');
    setOpen(false);
    setActiveIndex(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      if (options.length > 0) {
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
      }
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault();
      choose(options[activeIndex].value);
    }
  };

  return (
    <div className="combobox">
      <label htmlFor={inputId}>Skills</label>
      <div className="combobox__anchor">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && options[activeIndex]
              ? `${listId}-option-${activeIndex}`
              : undefined
          }
          value={draft}
          maxLength={100}
          autoComplete="off"
          placeholder="Add a skill"
          disabled={selected.length >= 10}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        />
        {open ? (
          <div className="combobox__menu" id={listId} role="listbox">
            {query.isPending ? (
              <p className="combobox__message" role="status">
                Loading skills…
              </p>
            ) : options.length > 0 ? (
              options.map((item, index) => (
                <button
                  id={`${listId}-option-${index}`}
                  className="combobox__option"
                  role="option"
                  aria-selected={index === activeIndex}
                  type="button"
                  key={item.value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item.value)}
                >
                  <span>{item.value}</span>
                  <span>{item.count}</span>
                </button>
              ))
            ) : (
              <p className="combobox__message">No matching skill exists.</p>
            )}
          </div>
        ) : null}
      </div>
      {selected.length > 0 ? (
        <div className="selected-skills" aria-label="Selected skills">
          {selected.map((skill) => (
            <span className="filter-chip" key={skill}>
              {skill}
              <button
                type="button"
                aria-label={`Remove ${skill} skill`}
                onClick={() =>
                  onChange(selected.filter((value) => value !== skill))
                }
              >
                <CloseIcon className="icon" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
