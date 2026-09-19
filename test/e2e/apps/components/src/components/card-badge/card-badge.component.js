<computed name="grade" value="props.value > 50 ? 'high' : 'low'" />

<span @css badge data-testid="badge">{{ props.value }}/{{ grade }}</span>
