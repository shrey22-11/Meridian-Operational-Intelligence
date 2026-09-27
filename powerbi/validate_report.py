"""Validate PBIR against Microsoft schemas plus local semantic field references."""
import json
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urljoin, urldefrag
import hashlib
import jsonschema
from referencing import Registry, Resource

HERE=Path(__file__).resolve().parent
CACHE=HERE/'.schemas';CACHE.mkdir(exist_ok=True)
def retrieve(uri):
    uri=urldefrag(uri)[0]
    path=CACHE/(hashlib.sha256(uri.encode()).hexdigest()+'.json')
    if not path.exists():path.write_bytes(urlopen(uri,timeout=30).read())
    return Resource.from_contents(json.loads(path.read_text()))

def main():
    report=json.loads((HERE/'Meridian.Report/definition/report.json').read_text())
    theme=report['themeCollection']['customTheme']
    resources=[i for p in report['resourcePackages'] for i in p['items']]
    resource=next(i for i in resources if i['name']==theme['name'])
    assert theme['name']==resource['path'] and theme['name'].endswith('.json'), 'Theme names must match the complete resource filename'
    theme_file=HERE/'Meridian.Report/StaticResources/RegisteredResources'/resource['path']
    assert json.loads(theme_file.read_text())['name']==theme['name']
    model=json.loads((HERE/'Meridian.SemanticModel/model.bim').read_text(encoding='utf-8'))['model']
    columns={t['name']:{c['name'] for c in t['columns']} for t in model['tables']}
    measures={t['name']:{m['name'] for m in t.get('measures',[])} for t in model['tables']}
    for rel in model['relationships']:
        assert rel['fromColumn'] in columns[rel['fromTable']]
        assert rel['toColumn'] in columns[rel['toTable']]
        assert rel['crossFilteringBehavior']=='oneDirection'
    registry=Registry(retrieve=retrieve)
    checked=[]
    paths=list((HERE/'Meridian.Report').rglob('*.json'))+list(HERE.rglob('*.pbir'))+list(HERE.rglob('*.pbism'))
    for p in paths:
        obj=json.loads(p.read_text(encoding='utf-8'))
        if '$schema' not in obj:continue
        schema=retrieve(obj['$schema']).contents
        validator=jsonschema.Draft7Validator(schema,registry=registry)
        errors=list(validator.iter_errors(obj))
        if errors:raise AssertionError(f'{p}: '+ '\n'.join(str(e) for e in errors))
        def walk(v):
            if isinstance(v,dict):
                for typ,look in [('Column',columns),('Measure',measures)]:
                    if typ in v:
                        f=v[typ];t=f.get('Expression',{}).get('SourceRef',{}).get('Entity')
                        if t:assert f['Property'] in look[t],(p,t,f)
                for child in v.values():walk(child)
            elif isinstance(v,list):
                for child in v:walk(child)
        walk(obj)
        checked.append(str(p.relative_to(HERE)))
    result={'schema_files_passed':len(checked),'semantic_field_references':'passed','theme_resource_mapping':'passed','relationships':len(model['relationships']),'note':'Schema validation does not replace Power BI Desktop refresh and DAX execution.'}
    (HERE.parent/'reports/powerbi/schema-validation.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
