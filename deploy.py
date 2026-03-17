#!/usr/bin/env python3
"""
Deployment script for RPStory.

This script automates:
1. Version bumping in src/html/template.html
2. Building index.html
3. Running tests
4. Committing, tagging, and pushing changes in rpstory repo
5. Deploying to the GitHub Pages repository
"""

import json
import os
import re
import subprocess
import sys
import shutil

def run_command(command, cwd=None, error_msg=None):
    """Run a shell command and exit on failure."""
    try:
        subprocess.run(command, cwd=cwd, check=True)
    except subprocess.CalledProcessError as e:
        if error_msg:
            print(f"Error: {error_msg}")
        else:
            print(f"Command failed: {' '.join(command)}")
        sys.exit(1)

def get_package_version():
    """Read the version from package.json"""
    try:
        with open('package.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('version')
    except Exception as e:
        print(f"Error reading package.json: {e}")
        sys.exit(1)

def update_version_in_file(filepath, new_version):
    """Update the version string in the specified file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Regex to find version string (e.g., v1.0.10)
        version_pattern = r'v\d+\.\d+\.\d+'
        
        # We want to replace it with v + the new version from package.json
        formatted_version = f"v{new_version}"
        
        if not re.search(version_pattern, content):
            print(f"Warning: Could not find version string pattern in {filepath}")
            return False
            
        new_content = re.sub(version_pattern, formatted_version, content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"Updated version in {filepath} to {formatted_version}")
        return True
    except Exception as e:
        print(f"Error updating version in {filepath}: {e}")
        sys.exit(1)

def main():
    # Configuration
    template_path = 'src/html/template.html'
    target_repo_dir = '../michael-f-ellis.github.io'
    target_sub_dir = 'rpstory'
    
    # 0. Ensure we are in the right directory
    if not os.path.exists(template_path):
        print(f"Error: Run this script from the root of the rpstory repository.")
        sys.exit(1)

    # 1. Get version from package.json
    print("Reading version from package.json...")
    version = get_package_version()
    new_version = f"v{version}"
    
    # Update version in templates
    update_version_in_file(template_path, version)
    update_version_in_file('index.template.html', version)

    # 2. Build
    print("Building index.html...")
    run_command([sys.executable, 'build.py'], error_msg="Build failed.")

    # 3. Test
    print("Running tests...")
    run_command(['npx', 'playwright', 'test'], error_msg="Tests failed. Aborting deployment.")

    # 4. Git Operations in rpstory
    print("Committing and tagging in rpstory...")
    run_command(['git', 'add', '.'])
    run_command(['git', 'commit', '-m', f"Bump version to {new_version}"])
    run_command(['git', 'push'])
    run_command(['git', 'tag', new_version])
    run_command(['git', 'push', 'origin', new_version])

    # 5. Deploy to GitHub Pages repo
    print(f"Deploying to {target_repo_dir}/{target_sub_dir}...")
    
    # Ensure destination exists
    destination_path = os.path.join(target_repo_dir, target_sub_dir)
    os.makedirs(destination_path, exist_ok=True)
    
    # Copy index.html
    shutil.copy2('index.html', os.path.join(destination_path, 'index.html'))
    print("Copied index.html to deployment target.")

    # Git update in GitHub Pages repo
    cwd = os.getcwd()
    try:
        os.chdir(target_repo_dir)
        print("Committing and pushing to GitHub Pages...")
        run_command(['git', 'add', target_sub_dir])
        # Use check=False for commit in case there are no changes (rare but possible)
        subprocess.run(['git', 'commit', '-m', f"Update rpstory to {new_version}"], check=False)
        run_command(['git', 'push'])
        print("Successfully deployed to GitHub Pages.")
    finally:
        os.chdir(cwd)

    print(f"\nDeployment of {new_version} complete!")

if __name__ == '__main__':
    main()
