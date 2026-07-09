#!/usr/bin/env python3
"""Auto-add missing UI component imports to all TSX files."""
import os
import re

UI_COMPONENTS = {
    'Card': 'card', 'CardContent': 'card', 'CardHeader': 'card', 'CardTitle': 'card',
    'CardDescription': 'card', 'CardFooter': 'card', 'CardAction': 'card',
    'Button': 'button',
    'Input': 'input',
    'Label': 'label',
    'Badge': 'badge',
    'Separator': 'separator',
    'ScrollArea': 'scroll-area',
    'Sheet': 'sheet', 'SheetContent': 'sheet', 'SheetHeader': 'sheet',
    'SheetTitle': 'sheet', 'SheetDescription': 'sheet', 'SheetTrigger': 'sheet',
    'Dialog': 'dialog', 'DialogContent': 'dialog', 'DialogHeader': 'dialog',
    'DialogTitle': 'dialog', 'DialogDescription': 'dialog', 'DialogFooter': 'dialog',
    'DialogTrigger': 'dialog', 'DialogClose': 'dialog',
    'AlertDialog': 'alert-dialog', 'AlertDialogContent': 'alert-dialog',
    'AlertDialogHeader': 'alert-dialog', 'AlertDialogTitle': 'alert-dialog',
    'AlertDialogDescription': 'alert-dialog', 'AlertDialogFooter': 'alert-dialog',
    'AlertDialogAction': 'alert-dialog', 'AlertDialogCancel': 'alert-dialog',
    'AlertDialogTrigger': 'alert-dialog',
    'Tabs': 'tabs', 'TabsList': 'tabs', 'TabsTrigger': 'tabs', 'TabsContent': 'tabs',
    'Select': 'select', 'SelectContent': 'select', 'SelectItem': 'select',
    'SelectTrigger': 'select', 'SelectValue': 'select', 'SelectGroup': 'select',
    'SelectLabel': 'select',
    'Checkbox': 'checkbox',
    'Switch': 'switch',
    'Slider': 'slider',
    'Textarea': 'textarea',
    'Tooltip': 'tooltip', 'TooltipContent': 'tooltip', 'TooltipTrigger': 'tooltip',
    'TooltipProvider': 'tooltip',
    'Popover': 'popover', 'PopoverContent': 'popover', 'PopoverTrigger': 'popover',
    'DropdownMenu': 'dropdown-menu', 'DropdownMenuContent': 'dropdown-menu',
    'DropdownMenuItem': 'dropdown-menu', 'DropdownMenuTrigger': 'dropdown-menu',
    'DropdownMenuSeparator': 'dropdown-menu', 'DropdownMenuLabel': 'dropdown-menu',
    'DropdownMenuGroup': 'dropdown-menu', 'DropdownMenuCheckboxItem': 'dropdown-menu',
    'Accordion': 'accordion', 'AccordionContent': 'accordion',
    'AccordionItem': 'accordion', 'AccordionTrigger': 'accordion',
    'Avatar': 'avatar', 'AvatarImage': 'avatar', 'AvatarFallback': 'avatar',
    'Progress': 'progress',
    'Skeleton': 'skeleton',
    'Toast': 'toast', 'ToastAction': 'toast', 'ToastClose': 'toast',
    'ToastDescription': 'toast', 'ToastTitle': 'toast',
    'Table': 'table', 'TableBody': 'table', 'TableCell': 'table',
    'TableHead': 'table', 'TableHeader': 'table', 'TableRow': 'table',
    'RadioGroup': 'radio-group', 'RadioGroupItem': 'radio-group',
    'Toggle': 'toggle', 'ToggleGroup': 'toggle-group',
    'Calendar': 'calendar',
    'Command': 'command', 'CommandInput': 'command', 'CommandList': 'command',
    'CommandItem': 'command', 'CommandGroup': 'command',
    'HoverCard': 'hover-card', 'HoverCardContent': 'hover-card',
    'HoverCardTrigger': 'hover-card',
}

def find_missing(filepath):
    """Return dict of {module_path: [component_names]} missing from file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not re.search(r'<[A-Z]', content):
        return None, content

    # Collect all existing import lines for ui components
    existing_ui_imports = set()
    import_pattern = re.compile(r'^import\s+\{([^}]+)\}\s+from\s+[\'"]@/components/ui/([^\'"]+)[\'"]', re.MULTILINE)
    for m in import_pattern.finditer(content):
        comps = [c.strip() for c in m.group(1).split(',')]
        mod = m.group(2)
        for c in comps:
            existing_ui_imports.add(c)

    missing_by_module = {}
    for comp, mod in UI_COMPONENTS.items():
        # Check JSX usage
        jsx_pattern = rf'<{comp}[\s/>]'
        if not re.search(jsx_pattern, content):
            continue
        if comp in existing_ui_imports:
            continue
        missing_by_module.setdefault(mod, []).append(comp)

    return missing_by_module, content

def apply_fixes(filepath, missing_by_module, content):
    """Add missing imports to the file."""
    if not missing_by_module:
        return False

    # Find a good insertion point — after the last existing ui import,
    # or after the last import line, or at the top after 'use client'
    lines = content.split('\n')

    # Find last import line index
    last_import_idx = -1
    last_ui_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i
            if '@/components/ui/' in line:
                last_ui_import_idx = i

    insert_idx = last_ui_import_idx if last_ui_import_idx >= 0 else last_import_idx
    if insert_idx < 0:
        # Find 'use client' directive
        for i, line in enumerate(lines):
            if line.strip() == "'use client';" or line.strip() == '"use client";':
                insert_idx = i
                break
        if insert_idx < 0:
            insert_idx = 0

    # Build import lines
    new_imports = []
    for mod in sorted(missing_by_module.keys()):
        comps = sorted(set(missing_by_module[mod]))
        comps_str = ', '.join(comps)
        new_imports.append(f"import {{ {comps_str} }} from '@/components/ui/{mod}';")

    # Insert after the chosen line
    insert_line = lines[insert_idx]
    # If inserting after a multi-import that spans lines, just append after this line
    new_lines = lines[:insert_idx + 1] + new_imports + lines[insert_idx + 1:]
    new_content = '\n'.join(new_lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return True

def main():
    src_dir = '/home/z/my-project/src'
    fixed_count = 0
    skipped = []

    for root, dirs, files in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next')]
        for f in files:
            if not f.endswith(('.tsx', '.ts')):
                continue
            filepath = os.path.join(root, f)
            try:
                missing, content = find_missing(filepath)
            except Exception as e:
                print(f"ERROR reading {filepath}: {e}")
                continue
            if not missing:
                continue
            # Skip UI internal files that re-export (calendar, carousel, sidebar, etc.
            # actually use other UI components legitimately — but they may have their own
            # imports in a different form. Let's still try to fix them.)
            try:
                if apply_fixes(filepath, missing, content):
                    fixed_count += 1
                    rel = filepath.replace('/home/z/my-project/', '')
                    mods = ', '.join(sorted(missing.keys()))
                    print(f"FIXED: {rel} (added: {mods})")
            except Exception as e:
                print(f"ERROR fixing {filepath}: {e}")
                skipped.append(filepath)

    print(f"\n=== SUMMARY ===")
    print(f"Files fixed: {fixed_count}")
    if skipped:
        print(f"Files skipped due to errors: {len(skipped)}")
        for s in skipped:
            print(f"  - {s}")

if __name__ == '__main__':
    main()
