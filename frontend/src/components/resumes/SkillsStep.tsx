import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Tag,
  TagCloseButton,
  TagLabel,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { useState, type KeyboardEvent } from 'react';
import type { ResumeFormState } from './resumeForm';

interface SkillsStepProps {
  form: ResumeFormState;
  onChange: (patch: Partial<ResumeFormState>) => void;
}

export function SkillsStep({ form, onChange }: SkillsStepProps) {
  const [draft, setDraft] = useState<string>('');

  const addSkill = (): void => {
    const parts = draft
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length === 0) return;
    const existing = new Set(form.skills.map((s) => s.toLowerCase()));
    const fresh = parts.filter((p) => {
      const k = p.toLowerCase();
      if (existing.has(k)) return false;
      existing.add(k);
      return true;
    });
    onChange({ skills: [...form.skills, ...fresh] });
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  return (
    <FormControl>
      <FormLabel>Your skills</FormLabel>
      <HStack>
        <Input
          value={draft}
          placeholder="e.g. Project management"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button onClick={addSkill} colorScheme="purple" variant="outline">
          Add
        </Button>
      </HStack>
      <FormHelperText>
        Type a skill and press Enter. You can add several at once by separating them with commas.
      </FormHelperText>
      <Wrap mt={4} spacing={2}>
        {form.skills.map((skill) => (
          <WrapItem key={skill}>
            <Tag size="lg" colorScheme="purple" borderRadius="full">
              <TagLabel>{skill}</TagLabel>
              <TagCloseButton
                aria-label={`Remove ${skill}`}
                onClick={() => onChange({ skills: form.skills.filter((s) => s !== skill) })}
              />
            </Tag>
          </WrapItem>
        ))}
      </Wrap>
    </FormControl>
  );
}
