#!/usr/bin/env python3
"""Accurate scan: find JSX components used without imports.
Handles imports without trailing semicolons and multi-line imports.
"""
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
    """Return dict {module: [components]} of truly missing imports."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not re.search(r'<[A-Z]', content):
        return None

    # Find all already-imported component names.
    # Match: import { Foo, Bar } from '@/components/ui/something'
    # Allow optional semicolon, multi-line.
    existing_imports = set()
    # Pattern: import { ... } from '@/components/ui/<mod>'
    # Use DOTALL for multi-line braces.
    pattern = re.compile(
        r"import\s*\{([^}]+)\}\s*from\s*['\"]@/components/ui/[^'\"]+['\"]\s*;?",
        re.DOTALL
    )
    for m in pattern.finditer(content):
        names = re.split(r'[,\n]', m.group(1))
        for n in names:
            n = n.strip()
            # Remove "as Alias"
            n = n.split(' as ')[0].strip()
            if n:
                existing_imports.add(n)

    # Also check for re-exports / barrel imports of these components
    # e.g., `import { Button } from '@/components/ui'`
    barrel_pattern = re.compile(
        r"import\s*\{([^}]+)\}\s*from\s*['\"]@/components/ui['\"]\s*;?",
        re.DOTALL
    )
    for m in barrel_pattern.finditer(content):
        names = re.split(r'[,\n]', m.group(1))
        for n in names:
            n = n.strip().split(' as ')[0].strip()
            if n:
                existing_imports.add(n)

    missing_by_module = {}
    for comp, mod in UI_COMPONENTS.items():
        # JSX usage: <Comp (followed by space, /, or >)
        jsx_pattern = rf'<{re.escape(comp)}[\s/>]'
        if not re.search(jsx_pattern, content):
            continue
        if comp in existing_imports:
            continue
        missing_by_module.setdefault(mod, []).append(comp)

    return missing_by_module

def main():
    src_dir = '/home/z/my-project/src'
    issues = []

    for root, dirs, files in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next')]
        for f in files:
            if not f.endswith(('.tsx', '.ts')):
                continue
            filepath = os.path.join(root, f)
            try:
                missing = find_missing(filepath)
            except Exception as e:
                print(f"ERROR: {filepath}: {e}")
                continue
            if missing:
                issues.append((filepath, missing))

    if not issues:
        print("NO MISSING IMPORTS FOUND — all good!")
        return

    print(f"FOUND {len(issues)} FILES WITH TRULY MISSING IMPORTS:\n")
    for filepath, missing in issues:
        rel = filepath.replace('/home/z/my-project/', '')
        print(f"\n{rel}:")
        by_module = {}
        for comp, mod in missing.items() if False else [(c, m) for m, comps in missing.items() for c in comps]:
            pass
        # Re-group
        by_module = {}
        for comp, mod in [(c, m) for m, comps in missing.items() for c in comps]:
            by_module.setdefault(mod, []).append(comp)
        for mod, comps in by_module.items():
            comps_str = ', '.join(sorted(set(comps)))
            print(f"  MISSING: import {{ {comps_str} }} from '@/components/ui/{mod}';")

if __name__ == '__main__':
    main()
