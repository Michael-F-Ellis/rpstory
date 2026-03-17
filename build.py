#!/usr/bin/env python3
"""
Build script for RPChat index.html
Processes and combines source files from src/ directory, 
and injects providers and system prompts from JSON files.
"""

import json
import os
import sys

# Define the source files in the order they should be concatenated
SRC_FILES = {
    'css': [
        'src/css/main.css',
    ],
    'js': [
        'src/js/010_elements.js',
        'src/js/020_constants.js',
        'src/js/030_utils.js',
        'src/js/050_StoryManager.js',
        'src/js/060_config.js',
        'src/js/070_systemPrompts.js',
        'src/js/080_api.js',
        'src/js/081_processor.js',
        'src/js/090_importExport.js',
        'src/js/100_main.js',
    ],
    'html': 'src/html/template.html'
}

def load_json_file(filepath):
    """Load and parse a JSON file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File {filepath} not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {filepath}: {e}")
        sys.exit(1)

def escape_js_string(s):
    """Escape a string for use in JavaScript"""
    return s.replace('\\', '\\\\').replace('`', r'`').replace('${', r'${')

def generate_providers_js(providers_data):
    """Generate JavaScript code for providers configuration"""
    provider_template = """\t\t\t['{id}', new AIProvider(
					'{id}',
					'{displayName}',
					'{endpoint}',
					[
{models}
					],
					{defaultMaxTokens},
					'{apiFormat}'
				)]"""
    model_template = "					new AIModel('{id}', '{displayName}', {defaultTemperature}{extraFields})"
    
    providers_js_parts = []
    for provider_id, provider_config in providers_data.items():
        models_js = []
        for model in provider_config['models']:
            extra_fields = model.get('extraFields', {})
            extra_fields_str = f", {json.dumps(extra_fields)}" if extra_fields else ""
            models_js.append(model_template.format(
                id=model['id'],
                displayName=model['displayName'],
                defaultTemperature=model['defaultTemperature'],
                extraFields=extra_fields_str
            ))
        
        providers_js_parts.append(provider_template.format(
            id=provider_id,
            displayName=provider_config['displayName'],
            endpoint=provider_config['endpoint'],
            models=",\n".join(models_js),
            defaultMaxTokens=provider_config.get('defaultMaxTokens', 5000),
            apiFormat=provider_config.get('apiFormat', 'openai')
        ))
        
    return "const PROVIDERS = new Map([\n" + ",\n".join(providers_js_parts) + "\n\t\t\t]);"

def generate_system_prompts_js(system_prompts_data):
    """Generate JavaScript code for system prompts configuration"""
    prompt_template = """\t\t\t{{
					name: '{name}',
					content: `{content}`
				}}"""
    prompts_map = system_prompts_data.get('map', {})
    
    prompts_js_parts = []
    for prompt_id, prompt_content in prompts_map.items():
        display_name = prompt_id.replace('_', ' ').title()
        if prompt_id == 'firstPerson':
            display_name = 'First Person'
        elif prompt_id == 'thirdPerson':
            display_name = 'Third Person'
        elif prompt_id == 'minimal':
            display_name = 'Minimal'
        
        escaped_content = escape_js_string(prompt_content)
        prompts_js_parts.append(prompt_template.format(name=display_name, content=escaped_content))
    
    return f"// Global variable to store system prompts\nlet systemPrompts = [\n" + ",\n".join(prompts_js_parts) + "\n];"

def read_and_concatenate(file_list):
    """Reads a list of files and returns their concatenated content."""
    content = ''
    for file_path in file_list:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content += f.read() + '\n'
        except FileNotFoundError:
            print(f"Error: Source file not found at {file_path}")
            sys.exit(1)
    return content

def build_index_html():
    """Build index.html from template and JSON files"""
    template_path = SRC_FILES['html']
    if not os.path.exists(template_path):
        print(f"Error: Template file not found at {template_path}")
        sys.exit(1)
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()
    except IOError as e:
        print(f"Error reading template: {e}")
        sys.exit(1)

    css_content = read_and_concatenate(SRC_FILES['css'])
    js_content = read_and_concatenate(SRC_FILES['js'])

    template_content = template_content.replace('/* {{CSS_PLACEHOLDER}} */', css_content)
    template_content = template_content.replace('// {{JS_PLACEHOLDER}}', js_content)
    
    providers_data = load_json_file('providers.json')
    system_prompts_data = load_json_file('systemprompts.json')
    
    providers_js = generate_providers_js(providers_data)
    system_prompts_js = generate_system_prompts_js(system_prompts_data)
    
    output_content = template_content.replace(
        '// {{PROVIDERS_PLACEHOLDER}}',
        providers_js
    ).replace(
        '// {{SYSTEM_PROMPTS_PLACEHOLDER}}',
        system_prompts_js
    )
    
    try:
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(output_content)
        print("Successfully built index.html")
    except IOError as e:
        print(f"Error writing output: {e}")
        sys.exit(1)

if __name__ == '__main__':
    build_index_html()
