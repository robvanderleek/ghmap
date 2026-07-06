import * as d3 from "d3";
import {useEffect, useState} from "react";
import {Octokit} from "octokit";
import ghcolors from '././assets/github-colors.json';

interface Repo {
    name: string;
    fork: boolean;
    language?: string | null | undefined;
}

interface RepoEntry {
    repo: Repo;
    value: number;
}

interface HierarchyRootNode {
    name: 'root';
    children: Array<RepoEntry>;
}

function App() {
    const owner = import.meta.env.VITE_GITHUB_OWNER;

    const filterHierarchy = (hierarchy: HierarchyRootNode) => {
        return {
            name: hierarchy.name,
            children: hierarchy.children.filter(entry => !entry.repo.fork)
        }
    }

    const getLanguageColor = (language: string | null | undefined) => {
        if (language) {
            return ghcolors[language as keyof typeof ghcolors].color || 'transparent';
        } else {
            return 'transparent';
        }
    }

    const renderChart = (hierarchy: any, owner: string) => {
        const width = 800;
        const height = 600;

        const data = d3.hierarchy(hierarchy);

        const root = d3.treemap<RepoEntry>()
            .tile(d3.treemapSquarify) // e.g., d3.treemapSquarify
            .size([width, height])
            .padding(1)
            .round(true)
            (data
                .sum(d => d.value || 0)
                .sort((a, b) => (b.value || 0) - (a.value || 0)));

        return (
            <svg width={width} height={height}>
                {root.leaves().map((leaf, i) => (
                    <g key={i} transform={`translate(${leaf.x0},${leaf.y0})`}>
                        <a href={`https://github.com/${owner}/${leaf.data.repo.name}`} target="_blank">
                            <rect
                                width={leaf.x1 - leaf.x0}
                                height={leaf.y1 - leaf.y0}
                                fill={getLanguageColor(leaf.data.repo.language)}
                                stroke="black"
                            />
                            <title>{leaf.data.repo.name}</title>
                            <text x={4} y={14} fontSize="10px" fill="black">
                                {leaf.data.repo.name}
                            </text>
                        </a>
                    </g>
                ))}
            </svg>
        );
    }

    const [hierarchy, setHierarchy] = useState<HierarchyRootNode | undefined>(undefined);

    useEffect(() => {
        const loadRepositories = async (octokit: Octokit, owner: string) => {
            const res = await octokit.rest.users.getByUsername({username: owner});
            if (res.data.type === 'Organization') {
                const res = await octokit.rest.repos.listForOrg({org: owner, per_page: 100});
                return res.data;
            } else {
                const res = await octokit.rest.repos.listForUser({username: owner, per_page: 100});
                return res.data;
            }
        }

        const loadHierarchy = async (owner: string): Promise<HierarchyRootNode> => {
            const octokit = new Octokit({auth: import.meta.env.VITE_GITHUB_TOKEN});
            const repos = await loadRepositories(octokit, owner);
            const result: HierarchyRootNode = {name: 'root', children: []};
            for (const repo of repos) {
                console.log(repo);
                const res = await octokit.rest.repos.listLanguages({owner, repo: repo.name});
                const languages = res.data;
                const totalNrOfBytes = Object.entries(languages).map(([_, nrOfBytes]) => nrOfBytes)
                    .reduce((prev, cur) => prev + cur, 0);
                result.children.push({repo, value: totalNrOfBytes});
            }
            return result;
        }

        const load = async () => {
            const cachedHierarchy = localStorage.getItem(`ghmap_${owner}`);
            if (cachedHierarchy) {
                setHierarchy(JSON.parse(cachedHierarchy));
            } else {
                const hierarchy = await loadHierarchy(owner);
                setHierarchy(hierarchy);
                localStorage.setItem(`ghmap_${owner}`, JSON.stringify(hierarchy));
            }
        }
        load();
    }, []);

    if (hierarchy) {
        return (
            <div style={{height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                {renderChart(filterHierarchy(hierarchy), owner)}
            </div>
        );
    } else {
        return (<h1>Loading...</h1>);
    }
}

export default App
